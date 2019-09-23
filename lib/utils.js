/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 02:41:15
 * @version $Id$
 */
const { escape } = require('mysql')

function hideProperty(host, name, value) {
  Object.defineProperty(host, name, {
    value: value,
    writable: true,
    enumerable: false,
    configurable: true
  })
}

function getType(val) {
  if (val === null) {
    return String(val)
  }
  return Object.prototype.toString
    .call(val)
    .slice(8, -1)
    .toLowerCase()
}
function parse$or(arr) {
  let sql = ''
  for (let it of arr) {
    sql += '('
    if (it.$and) {
      sql += parse$and(it.$and)
    } else {
      sql += parse$opt(it)
    }
    sql += ') OR '
  }
  sql = sql.slice(0, -3)
  return sql
}
function parse$and(arr) {
  let sql = ''
  for (let it of arr) {
    sql += '('
    if (it.$or) {
      sql += parse$or(it.$or)
    } else {
      sql += parse$opt(it)
    }
    sql += ') AND '
  }
  sql = sql.slice(0, -4)
  return sql
}

function parse$opt(opt) {
  let sql = ''
  for (let k in opt) {
    let tmp = opt[k]
    switch (getType(tmp)) {
      case 'object':
        if (tmp.$like) {
          sql += ` ${k} LIKE ${escape(tmp.$like)} `
          break
        }
        if (tmp.$sql) {
          sql += ` ${k} ${tmp.$sql} `
          break
        }

        if (tmp.$in) {
          let list = tmp.$in.map(it => {
            return escape(it)
          })
          sql += ` ${k} IN (${list.join(',')}) `
          break
        }
        if (tmp.$between) {
          if (tmp.$between.length < 2) {
            throw new Error(`Array $between's length must be 2.`)
          }
          let list = tmp.$between.map(it => {
            return escape(it)
          })
          sql += ` ${k} BETWEEN ${list[0]} AND ${list[1]} `
          break
        }
        // 比较
        if (tmp.hasOwnProperty('$lt') || tmp.hasOwnProperty('$lte')) {
          let oc = tmp.hasOwnProperty('$lt') ? '<' : '<='
          let val = tmp.hasOwnProperty('$lt') ? tmp.$lt : tmp.$lte

          sql += ` ${k} ${oc} ${escape(val)} `

          if (tmp.hasOwnProperty('$gt') || tmp.hasOwnProperty('$gte')) {
            oc = tmp.hasOwnProperty('$gt') ? '>' : '>='
            val = tmp.hasOwnProperty('$gt') ? tmp.$gt : tmp.$gte
            sql += ` AND ${k} ${oc} ${escape(val)} `
          }
          break
        }
        if (tmp.hasOwnProperty('$gt') || tmp.hasOwnProperty('$gte')) {
          let oc = tmp.hasOwnProperty('$gt') ? '>' : '>='
          let val = tmp.hasOwnProperty('$gt') ? tmp.$gt : tmp.$gte
          sql += ` ${k} >${oc} ${escape(val)} `
          break
        }

        if (tmp.hasOwnProperty('$eq')) {
          sql += ` ${k} = ${escape(tmp.$eq)} `
          break
        }
        if (tmp.hasOwnProperty('$ne')) {
          sql += ` ${k} <> ${escape(tmp.$ne)} `
          break
        }
      default:
        sql += ` ${k} = ${escape(tmp)}`
    }
    sql += ' AND '
  }
  sql = sql.slice(0, -4)
  return sql
}

// 格式化表名
function fixtable(name) {
  if (/ AS /i.test(name)) {
    return name
  }
  return name
    .split('.')
    .map(it => {
      return '`' + it + '`'
    })
    .join('.')
}

const parser = {
  leftJoin(tables = []) {
    let sql = ''
    for (let it of tables) {
      it.table = fixtable(it.table)
      sql += ` LEFT JOIN ${it.table} ON ${it.on} `
    }
    return sql
  },

  rightJoin(tables = []) {
    let sql = ''
    for (let it of tables) {
      it.table = fixtable(it.table)
      sql += ` RIGHT JOIN ${it.table} ON ${it.on} `
    }
    return sql
  },

  join(tables = []) {
    let sql = ''
    for (let it of tables) {
      it.table = fixtable(it.table)
      sql += ` JOIN ${it.table} ON ${it.on} `
    }
    return sql
  },

  filter(opt) {
    let sql = ''
    if (!opt) {
      return ' '
    }
    if (typeof opt === 'string') {
      sql += opt
    }
    if (typeof opt === 'function') {
      sql += opt()
    }
    if (typeof opt === 'object') {
      if (opt.$and) {
        sql += parse$and(opt.$and)
      } else if (opt.$or) {
        sql += parse$or(opt.$or)
      } else {
        sql += parse$opt(opt)
      }
    }
    sql = sql.trim()
    if (sql) {
      return ` WHERE ${sql} `
    } else {
      return ' '
    }
  },

  select(arr = ['*']) {
    return `SELECT ${arr.join(',')} `
  },

  // 排序 ----------------------------------
  sort(obj = {}) {
    let sort = ''
    for (let i in obj) {
      let c = ''
      if (obj[i] === -1) {
        c = 'DESC'
      }
      sort += `${i} ${c},`
    }
    if (sort) {
      return ' ORDER BY ' + sort.slice(0, -1)
    } else {
      return ''
    }
  },

  limit(...args) {
    return ` LIMIT ${args.join(',')} `
  },

  // 解析数据表的配置(新建表时)
  field(fields = []) {
    let primary = null
    let indexes = []
    let sql = `(\n`
    for (let it of fields) {
      it.type = it.type.toUpperCase()
      let inc = '' // 自增
      let autoUpdate = '' // 自动更新时间戳(仅 DATETIME & TIMESTAMP)
      let defaultVal = ''
      // 只处理1个主键, 其他的忽略, 且作为主键,必须 NOT NULL
      if (!primary && it.primary) {
        primary = `PRIMARY KEY (\`${it.name}\`)`
        it.notnull = true
        if (it.inc) {
          inc = 'AUTO_INCREMENT'
        }
      }
      let notnull = it.notnull ? 'NOT NULL' : 'NULL'

      if (~it.type.indexOf('CHAR')) {
        it.default = it.default ? escape(it.default) : ''
      }

      // 这几种类型,不允许设置默认值
      if (['TEXT', 'BLOB', 'JSON', 'GEOMETRY'].includes(it.type)) {
        notnull = 'NULL'
        delete it.default
      }

      // 这2种类型,如果设置了自动更新时间戳, 则默认值自动改为当前时间戳
      if (['TIMESTAMP', 'DATETIME'].includes(it.type)) {
        if (it.update) {
          autoUpdate = 'ON UPDATE CURRENT_TIMESTAMP'
          it.default = 'CURRENT_TIMESTAMP'
        }
      }

      // 这3种时间类型,不允许设置默认值为 当前时间戳
      if (['TIME', 'DATE', 'YEAR'].includes(it.type)) {
        if (it.default.toUpperCase() === 'CURRENT_TIMESTAMP') {
          delete it.default
        }
      }
      if (it.default || it.default === 0) {
        defaultVal = 'DEFAULT ' + it.default
      }

      // 非主键下, 设置了unique & index时,都为索引
      if (!it.primary) {
        if (it.index || it.unique) {
          let idx = `INDEX \`${it.name}_idx\` (\`${it.name}\`)`
          if (it.unique) {
            idx = 'UNIQUE ' + idx
          }
          indexes.push(idx)
        }
      }
      sql += `\`${it.name}\` ${it.type} ${notnull} ${defaultVal} ${inc} ${autoUpdate},\n`
    }
    if (!primary) {
      throw new Error('Can not create table without primary key.')
    }
    sql += primary
    if (indexes.length) {
      sql += ',\n' + indexes.join(', \n') + ')'
    } else {
      sql += '\n)'
    }
    return sql
  }
}

class SqlErr {
  constructor(msg = '', sql = '') {
    this.message = msg
    this.sql = sql
    hideProperty(this, 'stack', msg)
  }

  toString() {
    return this.message
  }
}

exports.SqlErr = SqlErr
exports.parser = parser
exports.escape = escape
exports.fixtable = fixtable
