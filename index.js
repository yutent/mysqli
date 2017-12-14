/**
 * mysql操作类
 * @authors yutent (yutent@doui.cc)
 * @date    2015-11-24 11:31:55
 *
 */
'use strict'
require('es.shim')
const mysql = require('mysql')
const Method = require('./lib/method')

if (!Promise.defer) {
  Promise.defer = function() {
    let obj = {}
    obj.promise = new this((yes, no) => {
      obj.resolve = yes
      obj.reject = no
    })
    return obj
  }
}
class Mysqli {
  /**
   * [constructor 构造数据库连接池]
   */
  constructor(config) {
    if (!Array.isArray(config)) {
      config = [config]
    }

    //是否有从库
    this.useSlaveDB = config.length > 1
    this.pool = mysql.createPoolCluster()

    config.forEach((item, i) => {
      let { host, port, user, charset, passwd: password, db: database } = item
      let name = i < 1 ? 'MASTER' : 'SLAVE' + i

      charset = charset || 'utf8'
      let collate =
        charset + (charset === 'utf8mb4' ? '_unicode_ci' : '_general_ci')

      this.pool.add(name, {
        host,
        port,
        user,
        charset,
        collate,
        password,
        database
      })
    })
    return this
  }

  //对外的escape方法
  static escape(val) {
    return mysql.escape(val)
  }

  emit(fromSlave = false, db) {
    const defer = Promise.defer()
    const slave = fromSlave && this.useSlaveDB ? 'SLAVE*' : 'MASTER'

    this.pool.getConnection(slave, (err, conn) => {
      if (err) {
        return defer.reject(`MySQL connect ${err}`)
      }
      if (db) {
        conn.query('USE ' + db, err => {
          if (err) {
            return defer.reject('Select DB ' + err)
          }
          defer.resolve(conn)
        })
      }
    })
    return new Method(defer.promise)
  }
}

module.exports = Mysqli
