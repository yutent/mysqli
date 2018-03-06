/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 14:01:03
 * @version $Id$
 */

const { escape } = require('mysql')
const parser = require('./parser')

class Method {
  constructor(defer) {
    this.defer = defer
  }

  listDb() {
    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query('SHOW DATABASES', (err, row) => {
        if (err) {
          return defer.reject({
            err: 'SHOW DATABASES ' + err,
            sql: ''
          })
        }
        defer.resolve(row.map(it => it.Database))
      })

      return defer.promise
    })
  }

  //返回数据表
  listTable() {
    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query('SHOW TABLES', (err, row) => {
        if (err) {
          return defer.reject({
            err: 'SHOW TABLES ' + err,
            sql: ''
          })
        }
        defer.resolve(row.map(it => Object.values(it)[0]))
      })

      return defer.promise
    })
  }

  /**
   * [query sql语句执行]
   * @param  {[type]}   sql       [sql语句]
   */
  query(sql) {
    if (typeof sql !== 'string')
      return Promise.reject({
        err: `Query error, argument sql must be string. ${typeof sql} given`,
        sql
      })

    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        if (err) {
          return defer.reject({ err: `Query ${err}`, sql })
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  find(condition, select) {
    const { table, leftJoin, rightJoin, join, where, sort, limit } = condition
    let sql = ''
    if (!table) {
      return Promise.reject({ err: 'Find Error: empty table', sql })
    }

    sql = parser.select(select)
    sql += `FROM ${table} `
    if (leftJoin) {
      sql += parser.leftJoin(leftJoin)
    }
    if (rightJoin) {
      sql += parser.rightJoin(rightJoin)
    }
    if (join) {
      sql += parser.join(join)
    }

    if (where) {
      sql += parser.where(where)
    }

    if (sort) {
      sql += parser.sort(sort)
    }

    if (limit) {
      sql += parser.limit(limit)
    }

    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        if (err) {
          return defer.reject({ err: `Find ${err}`, sql })
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  findOne(condition, select) {
    condition.limit = [1]
    return this.find(condition, select).then(row => {
      return row[0] || null
    })
  }

  count(condition) {
    delete condition.limit
    return this.find(condition, ['count(*) AS total']).then(row => {
      return (row[0] && row[0].total) || 0
    })
  }

  insert({ table }, doc) {
    let sql = ''
    if (!table) {
      return Promise.reject({ err: 'Insert Error: empty table', sql })
    }

    sql = `INSERT INTO ${table} `
    let keys = []
    let vals = []

    for (let i in doc) {
      keys.push(i)
      vals.push(escape(doc[i]))
    }
    sql += `(${keys.join(',')}) VALUES (${vals.join(',')})`

    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        if (err) {
          return defer.reject({ err: `Insert ${err}`, sql })
        }

        defer.resolve(result.insertId)
      })

      return defer.promise
    })
  }

  update({ table, where }, doc) {
    let sql = ''
    if (!table) {
      return Promise.reject({ err: 'Update Error: empty table', sql })
    }

    sql = `UPDATE ${table} SET `

    let fields = [] //要更新的字段
    for (let i in doc) {
      let val = doc[i]
      if (typeof val === 'object' && val.$sql) {
        val = `(${val.$sql})`
      } else {
        val = escape(val)
      }
      fields.push(i + ' = ' + val)
    }
    sql += fields.join(',')
    sql += parser.where(where)

    return this.defer.then(conn => {
      const defer = Promise.defer()
      conn.query(sql, (err, res) => {
        if (err) {
          return defer.reject({ err: `Update ${err}`, sql })
        }

        defer.resolve(res.affectedRows)
      })
      return defer.promise
    })
  }

  remove({ table, where }) {
    let sql = ''
    if (!table) {
      return Promise.reject({ err: 'Remove Error: empty table', sql })
    }

    sql = `DELETE FROM \`${table}\` `

    if (where) {
      sql += parser.where(where)
    }

    return this.defer.then(conn => {
      const defer = Promise.defer()
      conn.query(sql, (err, res) => {
        if (err) {
          return defer.reject({ err: `Remove ${err}`, sql })
        }

        defer.resolve(res.affectedRows)
      })
      return defer.promise
    })
  }
}

module.exports = Method
