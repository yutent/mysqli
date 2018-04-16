/**
 * mysql操作类
 * @authors yutent (yutent@doui.cc)
 * @date    2015-11-24 11:31:55
 *
 */
'use strict'
import 'es.shim'
const mysql = require('mysql')
import Api from './lib/api'

class Mysqli {
  useSlaveDB: boolean
  pool: any
  /**
   * [constructor 构造数据库连接池]
   */
  constructor(config: any) {
    if (!Array.isArray(config)) {
      config = [config]
    }

    //是否有从库
    this.useSlaveDB = config.length > 1
    this.pool = mysql.createPoolCluster({
      removeNodeErrorCount: 1, // 连续失败立即从节点中移除, 并在10秒后尝试恢复
      restoreNodeTimeout: 10000
    })

    config.forEach((item: { [prop: string]: any }, i: number) => {
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

      charset = charset || 'utf8'
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
  static escape(val: any) {
    return mysql.escape(val)
  }

  emit(fromSlave = false, db: string = '') {
    let slave = fromSlave && this.useSlaveDB ? 'SLAVE*' : 'MASTER'
    return new Api(this.pool, slave, db)
  }
}

module.exports = Mysqli
