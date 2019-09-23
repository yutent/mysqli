/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2018-04-13 14:30:49
 * @version $Id$
 */

const { SqlErr, parser, fixtable } = require('./utils')
const Method = require('./method')

class Api {
  constructor(pool, slave = 'MASTER', db = '') {
    this.pool = pool
    this.slave = slave
    this.db = db ? '`' + db + '`' : null
  }

  connect() {
    let defer = Promise.defer()
    this.pool.getConnection(this.slave, (err, conn) => {
      if (err) {
        return defer.reject(new SqlErr(`MySQL connect ${err}`))
      }
      if (this.db) {
        conn.query('USE ' + this.db, err => {
          if (err) {
            return defer.reject(new SqlErr('Use DB ' + err))
          }
          defer.resolve(conn)
        })
      } else {
        defer.resolve(conn)
      }
    })
    return defer.promise
  }

  table(name) {
    if (!name) {
      throw new SqlErr('Query Error: empty table')
    }
    name = fixtable(name)
    return new Method(this.pool, this.slave, this.db, name)
  }

  /**
   * [query sql语句执行]
   * @param  {[type]}   sql       [sql语句]
   */
  query(sql) {
    if (typeof sql !== 'string') {
      return Promise.reject(
        new SqlErr(
          `Query error, argument sql must be string. ${typeof sql} given`,
          sql
        )
      )
    }

    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Query ${err}`, sql))
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  drop(db) {
    if (!this.db && db) {
      return Promise.reject('No database selected.')
    }
    this.db = db || this.db
    let defer = Promise.defer()

    this.connect().then(conn => {
      conn.query(`DROP DATABASE IF EXISTS ${db || this.db}`, err => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Drop database ${err}`))
        }
        defer.resolve(true)
      })
    })
    return defer.promise
  }

  dbList() {
    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query('SHOW DATABASES', (err, row) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr('Show databases ' + err))
        }
        defer.resolve(row.map(it => it.Database))
      })

      return defer.promise
    })
  }

  //返回数据表
  tableList() {
    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query('SHOW TABLES', (err, row) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr('Show tables ' + err))
        }
        defer.resolve(row.map(it => it[Object.keys(it)[0]]))
      })

      return defer.promise
    })
  }

  // 创建新的数据库
  dbCreate(name, { charset = 'utf8mb4' } = {}) {
    if (!name) {
      return Promise.reject('Empty database name.')
    }

    let sql = `CREATE DATABASE \`${name}\` DEFAULT CHARACTER SET = \`${charset}\``
    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr('Create database ' + err))
        }
        defer.resolve(true)
      })

      return defer.promise
    })
  }

  // 创建新的表,
  tableCreate(name, fields, { charset = 'utf8mb4', engine = 'InnoDB' } = {}) {
    if (!name) {
      return Promise.reject('Empty database name.')
    }

    let sql = `CREATE TABLE \`${name}\` `

    try {
      sql += parser.field(fields)
    } catch (err) {
      return Promise.reject(err + '')
    }

    sql += ` ENGINE=${engine} DEFAULT CHARSET=${charset}`

    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr('Create table ' + err, sql))
        }
        defer.resolve(true)
      })

      return defer.promise
    })
  }
}

module.exports = Api
