/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 14:01:03
 * @version $Id$
 */

import { defer, SqlErr, parser, escape } from './utils'

console.log(escape(new Date()))
interface Conn {
  query(sql: string, cb?: any): void
  release(): void
}
class Method {
  pool: any
  slave: string
  db: string
  cache: { [prop: string]: any } = {}

  constructor(pool: object, slave: string, db: string, table: string) {
    this.pool = pool
    this.slave = slave
    this.db = db
    this.cache = { table }
  }

  private connect() {
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

  leftJoin(tables: any[]) {
    this.cache.leftJoin = tables
    return this
  }

  rightJoin(tables: any[]) {
    this.cache.rightJoin = tables
    return this
  }

  join(tables: any[]) {
    this.cache.join = tables
    return this
  }

  /**
   * [filter 过滤条件]
   * @param {any} val [支持多种形式的过滤]
   * sql: .filter('name like "foo%" and age > 18')
   * func: .filter(function(){return 'name = "xiaoming"'})
   * obj: .filter({
   *         name: {$like: 'foo%'}
   *         age: {$gt: 18}
   *     })
   * obj形式的过滤, 支持多种多样, 详细请看Readme介绍
   */
  filter(val: any) {
    this.cache.filter = val
    return this
  }

  /**
   * [sort 对记录按指定字段排序]
   * @param {number }} keys [以对象形式传入值]
   * 如: {name: 1, age: -1} 1代表顺序, -1代表逆序
   */
  sort(keys: { [prop: string]: number }) {
    this.cache.sort = keys
    return this
  }

  // 从第几条记录开始返回, 必须搭配limit使用,否则会被忽略
  skip(skip: number) {
    this.cache.skip = skip
    return this
  }

  // 返回指定数量的记录
  limit(size: number) {
    this.cache.size = size
    return this
  }

  // 截取指定范围内的记录
  slice(start: number, end: number) {
    this.cache.limit = [start, end - start]
    return this
  }

  /**
   * [withFields 选取指定的字段]
   * @param {string[]} fields [以数组形式传入]
   */
  withFields(fields: string[]) {
    this.cache.fields = fields
    return this
  }

  // ================================================================
  // ====================== 以下方法,才是sql执行 =======================
  // ================================================================

  /**
   * [getAll 获取所有记录]
   * @param {any[]} ids [description]
   */
  getAll(ids?: any[]) {
    if (!this.cache.filter && ids) {
      this.cache.filter = { id: { $in: ids } }
    }

    let {
      table,
      leftJoin,
      rightJoin,
      join,
      filter,
      fields,
      sort,
      skip,
      size,
      limit
    } = this.cache

    // 没有使用 slice方法的前提下, 通过skip/limit补全
    if (!limit) {
      if (size && size > 0) {
        limit = [size]
        if (skip !== undefined) {
          limit.unshift(skip)
        }
      }
    }

    let sql: string
    sql = parser.select(fields)
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

    if (filter) {
      sql += parser.filter(filter)
    }

    if (sort) {
      sql += parser.sort(sort)
    }

    if (limit) {
      sql += parser.limit(limit)
    }

    return this.connect().then((conn: Conn) => {
      let out = defer()

      conn.query(sql, (err: Error, result: any[]) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr(`Find ${err}`, sql))
        }
        out.resolve(result)
      })
      return out.promise
    })
  }

  /**
   * [get 获取单条记录详细]
   * @param {any} id [取主键值为id的记录, 当且仅当没设置过滤条件时有效]
   */
  get(id?: any) {
    return this.getAll(id ? [id] : null).then((list: any[]) => {
      return list[0]
    })
  }

  /**
   * [count 获取记录总数]
   * @return {number} [description]
   */
  count(): number {
    return this.getAll().then((list: any[]) => {
      return list.length
    })
  }

  /**
   * [insert 插入单条文档, 返回当前插入的文档的ID(如果是自增)]
   * @param {any }} doc [文档object]
   */
  insert(doc: { [prop: string]: any }) {
    if (!doc) {
      return Promise.reject(new SqlErr('Insert Error: empty document'))
    }
    let { table } = this.cache
    let sql = `INSERT INTO ${table} `
    let keys = []
    let vals = []

    for (let i in doc) {
      keys.push(i)
      vals.push(escape(doc[i]))
    }
    sql += `(${keys.join(',')}) VALUES (${vals.join(',')})`

    return this.connect().then((conn: Conn) => {
      const out = defer()

      conn.query(sql, (err: Error, result: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr(`Insert ${err}`, sql))
        }

        out.resolve(result.insertId)
      })

      return out.promise
    })
  }

  /**
   * [update 更新文档, 返回更新成功的文档数量]
   * 可以使用filter过滤条件
   * @param {any }} doc [要更新的字段]
   */
  update(doc: { [prop: string]: any }) {
    if (!doc) {
      return Promise.reject(new SqlErr('Update Error: empty document'))
    }
    let { table, filter } = this.cache
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
    sql += parser.filter(filter)

    return this.connect().then((conn: Conn) => {
      const out = defer()

      conn.query(sql, (err: Error, result: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr(`Update ${err}`, sql))
        }

        out.resolve(result.affectedRows)
      })

      return out.promise
    })
  }

  /**
   * [remove 删除文档, 返回删除成功的文档数量]
   * 可以使用filter过滤条件
   */
  remove() {
    let { table, filter } = this.cache
    let sql = `DELETE FROM ${table} `
    sql += parser.filter(filter)

    return this.connect().then((conn: Conn) => {
      const out = defer()

      conn.query(sql, (err: Error, result: any) => {
        conn.release()
        if (err) {
          return out.reject(new SqlErr(`Remove ${err}`, sql))
        }

        out.resolve(result.affectedRows)
      })

      return out.promise
    })
  }
}

export default Method
