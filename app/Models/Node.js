'use strict'

const Model = use('Model')

const IndexableModel = use('./IndexableModel')


class Node extends IndexableModel {


  static get table() {
    return 'nodes'
  }


  static boot() {
    super.boot()


  }

}

module.exports = Node
