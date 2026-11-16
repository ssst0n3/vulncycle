---

tags: 漏洞简易上报
spec_version: v0.1.0
usage: 简易漏洞上报; 只保留基本信息、漏洞介绍、漏洞复现
version: v0.1.0
changelog:
  - v0.1.0: init

---

# [简易上报] 项目名 漏洞名

## 一、基本信息

| Item             | Details                                          | Note                                        |
|------------------|--------------------------------------------------|---------------------------------------------|
| Project          | TODO: [org/repo](https://github.com/org/repo)    |
| Affect Version   | TODO: vX.Y.Z – vX.Y.Z                            |
| CVSS             | TODO: 0.0 CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:L/SC:N/SI:N/SA:N |
| Reporter         | TODO: [name](https://github.com/username)        |
| Report Date      | TODO: 1970-01-01                                 |

## 二、漏洞介绍

### 1. 漏洞描述

TODO: 一段话描述漏洞——什么组件的什么方法/数据流存在什么缺陷，该缺陷使什么安全机制失效，攻击者如何利用，影响什么版本。

### 2. 影响

#### 2.1 范围

* 受影响版本：TODO: 缺陷随哪个 PR 引入哪个版本；修复仅合入哪里，未 backport 到哪些稳定版。
* 受影响组件：TODO: 哪些功能/路径受影响。

#### 2.2 危害

攻击前提：TODO: 所需权限、触发条件、是否需要额外权限。

危害（条目式，或用"危害 | 机制 | 效果"三列表）：

1. **TODO: 危害类别 1**：TODO: 描述。
2. **TODO: 危害类别 2**：TODO: 描述。

#### 2.3 CVSS（by TODO: 评分者）

`TODO: 分数` CVSS:4.0/AV:?/AC:?/AT:?/PR:?/UI:?/VC:?/VI:?/VA:?/SC:?/SI:?/SA:?

| 维度 | 值 | 理由 |
|---|---|---|
| AV | TODO | TODO |
| AC | TODO | TODO |
| AT | TODO | TODO |
| PR | TODO | TODO |
| UI | TODO | TODO |
| VC | TODO | TODO |
| VI | TODO | TODO |
| VA | TODO | TODO |
| SC/SI/SA | TODO | TODO |

## 三、漏洞复现

### 1. 复现环境

TODO: 环境标识（如 dqd 环境链接）

```shell
$ TODO: 环境启动命令
$ TODO: 环境接入命令
```

环境信息：

```shell
TODO: 环境版本信息
```

复现参数：

| 项 | 值 |
|---|---|
| 目标版本 | TODO |
| 对外地址 | TODO |
| 管理员 / 攻击者账号 | TODO |
| 触发载荷 | TODO |

### 2. 复现步骤：TODO: 步骤名称

> 每个步骤按此骨架展开（2..N 按需重复）。

TODO: 步骤意图——最小反例还是真实场景；实验组与对照组如何设计。

TODO: poc 文件:

```yaml
TODO: poc 文件内容
```

测试步骤：

```shell
TODO: 执行命令及输出
```

测试结果：

| 用例 | TODO: 输入 | 求值路径/前置 | 正确判定 | 实测 | 结论 |
|---|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO | TODO |

TODO: 结论——证明什么。

### 3. 复现结果（可选，多步骤总收尾）

TODO: 关键结果原文（日志/输出全文）。

| # | 确认项 | 证据 |
|---|---|---|
| TODO | TODO | TODO |
