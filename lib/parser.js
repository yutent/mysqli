/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 02:41:15
 * @version $Id$
 */
const { escape } = require('mysql')

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
        if (tmp.$lt || tmp.$lte) {
          sql += ` ${k} <${tmp.$lte ? '=' : ''} ${tmp.$lt || tmp.$lte} `
          if (tmp.$gt || tmp.$gte) {
            sql += ` AND ${k} >${tmp.$gte ? '=' : ''} ${tmp.$gt || tmp.$gte} `
          }
          break
        }
        if (tmp.$gt || tmp.$gte) {
          sql += ` ${k} >${tmp.$gte ? '=' : ''} ${tmp.$gt || tmp.$gte} `
          break
        }

        if (tmp.$eq) {
          sql += ` ${k} = ${tmp.$eq} `
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

const Parser = {
  leftJoin(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` LEFT JOIN ${it.table} ON ${it.on} `
    }
    return sql
  },

  rightJoin(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` RIGHT JOIN ${it.table} ON ${it.on} `
    }
    return sql
  },

  join(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` JOIN ${it[0]} ON ${it.on} `
    }
    return sql
  },

  where(opt) {
    if (typeof opt === 'string') {
      return ` WHERE ${opt} `
    }
    if (typeof opt === 'function') {
      return ` WHERE ${opt()} `
    }
    if (typeof opt === 'object') {
      if (opt.$and) {
        return parse$and(opt.$and)
      } else if (opt.$or) {
        return parse$or(opt.$or)
      }
      return ` WHERE ${parse$opt(opt)}`
    }

    return ' '
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
  }
}

module.exports = Parser
