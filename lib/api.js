/**
 *
 * @author yutent<yutent.io@gmail.com>
 * @date 2020/11/24 20:04:39
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

    return new Method(this.pool, this.slave, this.db, name, this.debug)
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

      if (this.debug) {
        console.log(`[${new Date().format('Y/m/d_H:i:s')}][debug]`, sql)
      }

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
    let defer = Promise.defer()

    return this.query(`DROP DATABASE IF EXISTS ${db || this.db}`)
  }

  dbList() {
    return this.query('SHOW DATABASES').then(list =>
      list.map(it => it.Database)
    )
  }

  //返回数据表
  tableList() {
    return this.query('SHOW TABLES').then(list =>
      list.map(it => it[Object.keys(it)[0]])
    )
  }

  // 创建新的数据库
  dbCreate(name, { charset = 'utf8mb4' } = {}) {
    if (!name) {
      return Promise.reject('Empty database name.')
    }
    let sql = `CREATE DATABASE \`${name}\` DEFAULT CHARACTER SET = \`${charset}\``

    return this.query(sql)
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

    return this.query(sql)
  }
}

module.exports = Api
