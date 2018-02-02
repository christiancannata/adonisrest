'use strict'

const Schema = use('Schema')

class NodesSchema extends Schema {
  up () {
    this.create('nodes', (table) => {
      table.increments()
      table.string("name")
      table.float("price")
      table.timestamps()
    })
  }

  down () {
    this.drop('nodes')
  }
}

module.exports = NodesSchema
