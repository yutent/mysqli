/**
 * mysql操作类
 * @authors yutent (yutent@doui.cc)
 * @date    2015-11-24 11:31:55
 *
 */
'use strict'
require('es.shim')
const mysql = require('mysql')
const Api = require('./lib/api')

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
    this.pool = mysql.createPoolCluster({
      removeNodeErrorCount: 1, // 连续失败立即从节点中移除, 并在10秒后尝试恢复
      restoreNodeTimeout: 10000
    })

    config.forEach((item, i) => {
      let {
        host,
        port,
        user,
        charset,
        passwd: password,
        db: database,
        timezone,
        supportBigNumbers,
        ...others
      } = item
      let name = i < 1 ? 'MASTER' : 'SLAVE' + i
      let collate

      charset = charset || 'utf8mb4'
      collate =
        charset + (charset === 'utf8mb4' ? '_unicode_ci' : '_general_ci')

      timezone = timezone || 'local'
      supportBigNumbers = !!supportBigNumbers

      this.pool.add(name, {
        host,
        port,
        user,
        charset,
        collate,
        password,
        database,
        timezone,
        supportBigNumbers,
        ...others
      })
    })
    return this
  }

  //对外的escape方法
  static escape(val) {
    return mysql.escape(val)
  }

  emit(fromSlave = false, db = '') {
    let slave = fromSlave && this.useSlaveDB ? 'SLAVE*' : 'MASTER'
    return new Api(this.pool, slave, db)
  }
}

module.exports = Mysqli
