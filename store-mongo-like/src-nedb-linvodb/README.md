# linvodb

> powerful js database designed for airtable-like pivot views, with mongo-like queries

# overview
- this project is a fork of linvodb v20210507
  - for web & nodejs

- https://github.com/Ivshti/linvodb3 /MIT
  - LinvoDB is based on NeDB, the most significant core change is that it uses LevelUP as a back-end, meaning it doesn't have to keep the whole dataset in memory.
  - linvodb is forked from [nedb v20141221](https://github.com/Ivshti/linvodb3/commits/master?before=569a0ac0b773f4cfba09c4597aed8f05e53c6b0b+455&branch=master&qualified_name=refs%2Fheads%2Fmaster)
  - https://github.com/aerys/linvodb3

- 放开思路，可以将insert/find视为key-value映射表的get/set
# usage

# bugs

- ❓ 代码中update操作然后remove，实际上update操作的cb比remove操作的cb后执行
# roadmap
- 从数据库读取数据的逻辑添加LRU作为缓存

## dev-to-list

- merge各个仓库的pr
# testing
- 迁移web版tests

## 待改进的测试

## tests-failed

# more
- deps backup
