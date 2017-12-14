/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 02:41:15
 * @version $Id$
 */
const { escape } = require('mysql')

/**
 * [parseWhere 格式化where条件]
 * @param  [array] arr [条件数组]
 */

function parseWhere(arr) {
  if (typeof arr === 'string' && !!arr) {
    return ' WHERE ' + arr
  } else if (Array.isArray(arr) && arr.length > 0) {
    let where = ''
    for (let it of arr) {
      it.join = it.join || 'AND'
      it.op = it.op || '='

      let fixVal = it.val
      if (
        !/(^\(SELECT\s+.*\)$)|^`/.test(it.val) &&
        !['IN', 'BETWEEN'].includes(it.op)
      ) {
        fixVal = escape(it.val)
      }

      where += `${it.join.toUpperCase()} ${it.key} ${it.op} ${fixVal} `
    }

    where = ' WHERE ' + where.trim().replace(/^(AND|OR)/, ' ') + ' '
    return where
  } else {
    return ' '
  }
}

const Parser = {
  leftJoin(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` LEFT JOIN ${it[0]} ON ${it[1]} `
    }
    return sql
  },

  rightJoin(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` RIGHT JOIN ${it[0]} ON ${it[1]} `
    }
    return sql
  },

  join(tables) {
    let sql = ''
    for (let it of tables) {
      sql += ` JOIN ${it[0]} ON ${it[1]} `
    }
    return sql
  },

  where(where = '') {
    return parseWhere(where)
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
