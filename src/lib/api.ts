/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2018-04-13 14:30:49
 * @version $Id$
 */

import { defer, SqlErr } from './utils'
import Method from './method'
interface Conn {
  query(sql: string, cb?: any): void
  release(): void
}
class Api {
  pool: any
  slave: string
  db: string
  constructor(pool: object, slave: string = 'MASTER', db: string = '') {
    this.pool = pool
    this.slave = slave
    this.db = db
  }

  connect() {
    let out = defer()
    this.pool.getConnection(this.slave, (err: Error, conn: Conn) => {
      if (err) {
        return out.reject(new SqlErr(`MySQL connect ${err}`))
      }
      if (this.db) {
        conn.query('USE ' + this.db, (err: Error) => {
          if (err) {
            return out.reject(new SqlErr('Select DB ' + err))
          }
          out.resolve(conn)
        })
      } else {
        out.resolve(conn)
      }
    })
    return out.promise
  }

  table(name: string) {
    if (!name) {
      throw new SqlErr('Query Error: empty table')
    }
    return new Method(this.pool, this.slave, this.db, name)
  }

  /**
   * [query sql语句执行]
   * @param  {[type]}   sql       [sql语句]
   */
  query(sql: string) {
    if (typeof sql !== 'string') {
      return Promise.reject(
        new SqlErr(
          `Query error, argument sql must be string. ${typeof sql} given`,
          sql
        )
      )
    }

    return this.connect().then((conn: Conn) => {
      let out = defer()

      conn.query(sql, (err: Error, result: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr(`Query ${err}`, sql))
        }
        out.resolve(result)
      })
      return out.promise
    })
  }

  drop() {
    if (!this.db) {
      return Promise.reject('')
    }

    this.connect().then((conn: Conn) => {
      conn.query('')
    })
  }

  dbList() {
    return this.connect().then((conn: Conn) => {
      let out = defer()

      conn.query('SHOW DATABASES', (err: Error, row: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr('SHOW DATABASES ' + err))
        }
        out.resolve(row.map((it: any) => it.Database))
      })

      return out.promise
    })
  }

  //返回数据表
  tableList() {
    return this.connect().then((conn: Conn) => {
      const out = defer()

      conn.query('SHOW TABLES', (err: Error, row: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr('SHOW TABLES ' + err))
        }
        out.resolve(row.map((it: any) => it[Object.keys(it)[0]]))
      })

      return out.promise
    })
  }
}

export default Api
