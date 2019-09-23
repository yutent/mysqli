/**
 *
 * @authors yutent (yutent@doui.cc)
 * @date    2017-12-14 14:01:03
 * @version $Id$
 */

const { SqlErr, parser, escape, fixtable } = require('./utils')

class Method {
  constructor(pool, slave, db, table) {
    this.pool = pool
    this.slave = slave
    this.db = db
    this.cache = { table }
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

  leftJoin(tables) {
    this.cache.leftJoin = tables
    return this
  }

  rightJoin(tables) {
    this.cache.rightJoin = tables
    return this
  }

  join(tables) {
    this.cache.join = tables
    return this
  }

  /**
   * [filter 过滤条件]
   * @param {any} val [支持多种形式的过滤]
   * sql: .filter('name like "foo%" and age > 18')
   * func: .filter(function(){return 'name = "xiaoming"'})
   * obj: .filter({
   *   name: {$like: 'foo%'}
   *   age: {$gt: 18}
   * })
   * obj形式的过滤, 支持多种多样, 详细请看Readme介绍
   */
  filter(val) {
    this.cache.filter = val
    return this
  }

  /**
   * [sort 对记录按指定字段排序]
   * @param {number }} keys [以对象形式传入值]
   * 如: {name: 1, age: -1} 1代表顺序, -1代表逆序
   */
  sort(keys) {
    this.cache.sort = keys
    return this
  }

  // 从第几条记录开始返回, 必须搭配limit使用,否则会被忽略
  skip(skip) {
    this.cache.skip = skip
    return this
  }

  // 返回指定数量的记录
  limit(size) {
    this.cache.size = size
    return this
  }

  // 截取指定范围内的记录
  slice(start, end) {
    this.cache.limit = [start, end - start]
    return this
  }

  /**
   * [withFields 选取指定的字段]
   * @param {string[]} fields [以数组形式传入]
   */
  withFields(fields) {
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
  getAll(ids) {
    if (!this.cache.filter && ids) {
      if (ids.length === 1) {
        this.cache.filter = { id: ids[0] }
      } else {
        this.cache.filter = { id: { $in: ids } }
      }
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

    let sql = parser.select(fields)
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

    return this.connect().then(conn => {
      let defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Find ${err}`, sql))
        }
        defer.resolve(result)
      })
      return defer.promise
    })
  }

  /**
   * [get 获取单条记录详细]
   * @param {any} id [取主键值为id的记录, 当且仅当没设置过滤条件时有效]
   */
  get(id) {
    return this.getAll(id ? [id] : null).then(list => {
      return list[0]
    })
  }

  /**
   * [count 获取记录总数]
   * @return {number} [description]
   */
  count() {
    return this.getAll().then(list => {
      return list.length
    })
  }

  /**
   * [insert 插入单条文档, 返回当前插入的文档的ID(如果是自增)]
   * @param {any }} doc [文档object]
   */
  insert(doc) {
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

    return this.connect().then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Insert ${err}`, sql))
        }

        defer.resolve(result.insertId)
      })

      return defer.promise
    })
  }

  /**
   * [update 更新文档, 返回更新成功的文档数量]
   * 可以使用filter过滤条件
   * @param {any }} doc [要更新的字段]
   */
  update(doc) {
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

    return this.connect().then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Update ${err}`, sql))
        }

        defer.resolve(result.affectedRows)
      })

      return defer.promise
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

    return this.connect().then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Remove ${err}`, sql))
        }

        defer.resolve(result.affectedRows)
      })

      return defer.promise
    })
  }

  drop() {
    let sql = `DROP TABLE IF EXISTS ${this.cache.table} `

    return this.connect().then(conn => {
      const defer = Promise.defer()

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Drop table ${err}`, sql))
        }

        defer.resolve(true)
      })

      return defer.promise
    })
  }

  // 重命名表
  renameTo(name) {
    return this.connect().then(conn => {
      const defer = Promise.defer()

      let sql = `RENAME TABLE ${this.cache.table} TO ${fixtable(name)}`
      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`List index ${err}`, sql))
        }

        defer.resolve(true)
      })

      return defer.promise
    })
  }

  // 返回索引列表
  indexList() {
    return this.connect().then(conn => {
      const defer = Promise.defer()

      let sql = `SHOW INDEX FROM ${this.cache.table}`
      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`List index ${err}`, sql))
        }
        let list = result.map(it => {
          return {
            name: it.Key_name,
            column: it.Column_name,
            unique: !it.Non_unique,
            cardinality: it.Cardinality,
            collation: it.Collation
          }
        })

        defer.resolve(list)
      })

      return defer.promise
    })
  }

  // 删除指定索引
  indexDrop(name) {
    if (!name) {
      return Promise.reject('Empty index name')
    }
    return this.connect().then(conn => {
      const defer = Promise.defer()

      let sql = `ALTER TABLE ${this.cache.table} DROP INDEX \`${name}\``
      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Drop index ${err}`, sql))
        }

        defer.resolve(true)
      })

      return defer.promise
    })
  }

  // 删除指定索引
  indexCreate(name, opt = {}) {
    if (!name) {
      return Promise.reject('Empty index name')
    }
    if (!opt.field) {
      return Promise.reject('Empty field name')
    }
    let unique = ''
    opt.field = '`' + opt.field + '`'
    if (opt.unique) {
      unique = 'UNIQUE'
    }

    return this.connect().then(conn => {
      const defer = Promise.defer()

      let sql = `ALTER TABLE ${this.cache.table} ADD ${unique} INDEX \`${name}\` (${opt.field})`

      conn.query(sql, (err, result) => {
        conn.release()
        if (err) {
          return defer.reject(new SqlErr(`Drop index ${err}`, sql))
        }

        defer.resolve(true)
      })

      return defer.promise
    })
  }
}

module.exports = Method
