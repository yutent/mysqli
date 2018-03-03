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

      conn.query('SHOW databases', (err, row) => {
        if (err) {
          return defer.reject('SHOW databases ' + err)
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

      conn.query('SHOW tables', (err, row) => {
        if (err) {
          return defer.reject('SHOW tables ' + err)
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
      return Promise.reject(
        `Query error, argument sql must be string. ${typeof sql} given`
      )

    return this.defer.then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        if (err) {
          return defer.reject(`Query ${err}; \nLast exec SQL:「${sql}」`)
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  find(condition, select) {
    const { table, leftJoin, rightJoin, join, where, sort, limit } = condition

    if (!table) {
      return Promise.reject('Filter Error: empty table')
    }

    let sql = parser.select(select)
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
          return defer.reject(`Filter ${err}; \nLast exec SQL:「${sql}」`)
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  findOne(condition, select) {
    condition.limit = [1]
    return this.filter(condition, select).then(row => {
      return row[0] || null
    })
  }

  count(condition) {
    delete condition.limit
    return this.filter(condition, ['count(*) AS total']).then(row => {
      return (row[0] && row[0].total) || 0
    })
  }

  insert({ table }, doc) {
    if (!table) {
      return Promise.reject('Insert Error: empty table')
    }

    let sql = `INSERT INTO ${table} `
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
          return defer.reject(`Insert ${err}; \nLast exec SQL: ${sql}`)
        }

        defer.resolve(result.insertId)
      })

      return defer.promise
    })
  }

  update({ table, where }, doc) {
    if (!table) {
      return Promise.reject('Update Error: empty table')
    }

    let sql = `UPDATE ${table} SET `

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
          return defer.reject(`Update ${err}; \nLast exec SQL: ${sql}`)
        }

        defer.resolve(res.affectedRows)
      })
      return defer.promise
    })
  }

  remove({ table, where }) {
    if (!table) {
      return Promise.reject('Remove Error: empty table')
    }

    let sql = `DELETE FROM \`${table}\` `

    if (where) {
      sql += parser.where(where)
    }

    return this.defer.then(conn => {
      const defer = Promise.defer()
      conn.query(sql, (err, res) => {
        if (err) {
          return defer.reject(`Remove ${err}; \nLast exec SQL: ${sql}`)
        }

        defer.resolve(res.affectedRows)
      })
      return defer.promise
    })
  }
}

module.exports = Method
