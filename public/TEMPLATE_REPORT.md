---

tags: 漏洞报告
spec_version: v0.4.0
usage: 提交0day漏洞报告; 展示漏洞详情; 重点表达如何发现
version: v0.4.0
changelog:
  - v0.1.0: xxx

---

# [挖掘报告] 项目名 漏洞名

## 一、基本信息

| Item             | Details                                          | Note                                        |
|------------------|--------------------------------------------------|---------------------------------------------|
| NickName         | TODO: vuln-nickname                              |
| Project          | TODO: [org/repo](https://github.com/org/repo)    |
| Introduce Date   | TODO: 1970-01-01                                 |
| Discovery Date   | TODO: 1970-01-01                                 |
| Publish Date     | TODO: 等待社区                                   |
| Confirm Link     | TODO: 等待社区                                   |
| CVE-ID           | TODO: 等待社区                                   |
| Exploits         | TODO: [exp1]()                                   |
| Affect Version   | TODO: vX.Y.Z – vX.Y.Z                            |
| Fix Version      | TODO: vX.Y.Z                                     |
| Fix Commit       | TODO: [`sha`](https://github.com/org/repo/commit/sha) |
| Introduce Commit | TODO: [`sha`](https://github.com/org/repo/commit/sha) |
| CVSS             | TODO: 0.0 CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:L/SC:N/SI:N/SA:N |
| Reporter         | TODO: [name](https://github.com/username)        |

## 二、漏洞引入

### 1. 引入定位

| 项 | 值 |
|---|---|
| PR | TODO: [#XXX](https://github.com/org/repo/pull/XXX) "PR 标题" |
| 承载缺陷的 commit | TODO: [`sha`](https://github.com/org/repo/commit/sha) |
| 作者 | TODO: name（`email@org`） |
| 日期 | TODO: 1970-01-01 |
| 首见版本 | TODO: vX.Y.Z（YYYY-MM-DD release） |
| Merge | TODO: 随 vX.Y 发版合入 |

TODO: PR 概述，说明引入了哪些文件、哪些函数/方法/数据流环节承载缺陷。

### 2. 引入内容

#### 2.1 背景与意图

**(1) 背景:**

TODO: 引入前的状态——原有机制如何工作、缺少什么能力、为什么需要这次引入。

**(2) 意图:**

TODO: 引入意图——这次 PR 想实现什么能力，关键设计选择是什么（如复用既有组件而非新造一套）。

TODO: 设计目标：明确正确行为应该是什么（如"不修改接收者"、"返回新值"、"校验目的地合法性"等）。

#### 2.2 引入代码

TODO: 说明承载缺陷的文件在引入 commit 中是新建还是修改，缺陷随代码落地即存在（可对父 commit `git cat-file -e` 验证）。

以数据流为纲列出各环节（环节名按缺陷形态自定：单点缺陷如"接收者类型/取接收者/缺陷操作/修改/返回"；链路缺陷如"入口/校验/透传/执行"）：

| 环节 | commit · 文件 | 动作 |
|---|---|---|
| TODO | TODO: `file:line` | TODO |

> TODO: 术语解释（关键概念，如"接收者"）。

#### 2.3 承载代码展开

按缺陷形态二选一（可混用）：

**写法一 · 单点缺陷**（缺陷集中在个别类型/方法，如浅拷贝突变）——按"核心类型 → 方法实现"展开。

TODO: 承载缺陷的核心类型定义，附引入 commit 的 diff：

```diff
TODO: 引入 commit 中类型定义的 diff
```

TODO: 承载缺陷的方法实现，附引入 commit 的 diff：

```diff
TODO: 引入 commit 中方法实现的 diff
```

其余同类方法:

<details><summary> 点击展开 </summary>

```diff
TODO: 其余同类方法的 diff
```

</details>

**写法二 · 链路缺陷**（缺陷由跨文件/跨 commit 的数据流构成，如 SSRF）——按 2.2 的环节逐节展开（2.3.1 – 2.3.N），每节含：职责说明、源码 permalink（blob/commit + 行号）、完整函数代码（关键行加 `// ←` 注释）。

##### 2.3.1 TODO: 环节名

TODO: 职责说明。

TODO: [源码链接](https://github.com/org/repo/blob/sha/path#Lxx-Lyy)

```go
TODO: 完整函数代码
```

### 3. 引入机制

TODO: 为实现某功能，新写/修改/复用代码时引入了什么实现层的问题。

**复用引入时**（缺陷来自复用既有代码/校验），展开为两小节：

#### 3.1 被复用代码的形态演化

| 阶段 | commit | 日期 | 作者 | 形态 |
|---|---|---|---|---|
| 引入 | TODO: [`sha`](url) | TODO | TODO | TODO: 当时形态 |
| 历史修复 | TODO: [`sha`](url) | TODO | TODO | TODO: 加了什么防护 |

TODO: 复用点当时的形态（附代码）。

#### 3.2 历史同类漏洞与当时的防护

TODO: 历史同类漏洞（CVE/issue）的修复加了哪些防护、为何对原场景充分（威胁模型/权限前提）。

### 4. 演化谱系

| 时间 | PR / Commit | 版本 | 变化 | 对缺陷的作用 |
|---|---|---|---|---|
| TODO: YYYY-MM-DD | TODO: [#XXX](url) / `sha` | TODO: vX.Y.Z | TODO: 变化描述 | **引入** / **修复** / **保留**（仅重构迁移） / **放大** / **收窄** |

> "放大/收窄"须写清前后形态变化（如"盲 SSRF → 非盲 SSRF：响应体经任务日志回灌"）。

TODO: 截至本文复核日期, 修复的 backport 状态——进了哪些版本、未进哪些稳定版、同根因其他实例的情况。

### 5. 引入过程归因（可选）

TODO: 作者为什么引入这个缺陷：

- 是否意识到该风险（注释/测试/命名证据）；
- 被复用防护（若有）的充分性前提是什么（如"提交者均为 sysadmin，不在威胁模型内"）；
- 引入场景下该前提是否仍成立（信任级别/攻击者集合是否变化）。

**引入本质**: TODO: 一句话（如"校验被复用到充分前提不再成立的威胁模型下"）。

## 三、漏洞发现

### 1. 切入点：为什么看这里

先交代挖掘环境：

| 项 | 值 |
|---|---|
| Agent / 工具 | TODO: 如 Claude Code、隐秘修复检测项目名 |
| 模型 | TODO |
| 工作目录 / 代码版本 | TODO: 分支 @ `sha`（日期） |
| 分析方式 | TODO: 只读静态分析 / 动态复现 |

切入点按实际二选一（或兼有）：

**(a) 外部信号驱动**：TODO: 注意力放在修复 commit 上的原因——隐秘修复检测项目、commit 签名特征、或其他信号。

**(b) 主动挖掘**：TODO: 威胁建模（STRIDE + DFD + 信任边界）→ 攻击面分析 → 逐级缩小目标，每级全量排查、排除法收敛到漏洞类。

### 2. 过程记录

TODO: 发现过程——进会话时 bug 是否已被定位、关键节点。

信号驱动时，附首条消息原文：

<details><summary>首条消息原文（TODO: 日期）</summary>

> TODO: 首条消息原文（检测项目输出或初始分析）

</details>

会话由用户逐条 prompt 驱动，关键节点:

| 时间 | 用户 prompt | 做的事 |
|---|---|---|
| TODO: YYYY-MM-DD HH:MM | TODO: prompt 摘要 | TODO: 做的事 |

多代理挖掘时（可选），附子代理分工与验证：

| 阶段 | 子代理 | 切片 / 任务 | 产出 |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

TODO: 主循环对子代理返回结果的验证方式与噪声过滤（如 N 条原始发现 → 核实保留 M 条）。

### 3. 漏洞挖掘方法

#### 3.1 复盘：真实挖掘方法

按实际路径二选一（或串接为"上游捞候选 + 下游确认落地"）：

**信号驱动（修复反推）**：

1. **捞候选**: TODO: 检测项目/方法如何从海量提交中筛出候选。
2. **定位缺陷**: TODO: 从修复签名反推缺陷形态。
3. **评估危害**: TODO: 缺陷如何影响系统行为。
4. **找触发条件**: TODO: 什么输入到达危险路径。
5. **真实场景复现**: TODO: 在什么环境上做了什么实验，验证了什么。

**目标驱动（正向挖掘）**：

```
威胁建模（STRIDE+DFD, 信任边界）→ 威胁清单
    ↓ 指导范围
攻击面分析（逐级缩小目标, 每级全量排查, 排除法收敛到漏洞类）
    ↓ 选题
该漏洞类下的全量 sink 枚举（机械标准: 用户可控输入 → 危险操作）
    ↓ 按攻击者权限下界排序
top-N 候选 → 逐个环节验证数据流（source 字段暴露性 ↔ sink 代码路径 配对验证）
    ↓ 验证/证伪
定级：确认是否漏洞
```

#### 3.2 思考：为什么有效？

TODO: 按上文所用方法谈深层原因：

- 信号驱动：为什么盯修复比盯功能代码高效；隐秘修复的两个可利用属性（修复不彻底、未 backport）。
- 目标驱动：排除法收敛、按攻击者权限下界排序、source↔sink 配对验证为何高效。

#### 3.3 扩展：同类问题挖掘方法

##### 3.3.1 漏洞模式复用

TODO: 归纳出的漏洞模式描述。

- TODO: 为什么此 bug 潜伏已久无人发现？
- TODO: 静态检查工具为何没覆盖到？

TODO: 相关 issue/讨论链接。

##### 3.3.2 检测方案

TODO: 该模式的可复用检测方案——检测什么特征、用什么工具/流程。

TODO: 该方案能否发现同根因的其他实例（B 类）？

## 四、漏洞介绍

### 1. 漏洞描述

TODO: 一段话描述漏洞——什么组件的什么方法/数据流存在什么缺陷，该缺陷使什么安全机制失效，攻击者如何利用，影响什么版本。

### 2. 影响

#### 2.1 范围

* 受影响版本：TODO: 缺陷随哪个 PR 引入哪个版本；修复仅合入哪里，未 backport 到哪些稳定版。
* 受影响组件：TODO: 哪些功能/路径受影响。
* 受影响部署（可选，影响随部署形态分层时）：

| 部署形态 | 是否受影响 | 说明 |
|---|---|---|
| TODO | TODO | TODO |

* 攻击者权限前提（可选，权限类漏洞时逐项回答）：

| 条件 | 事实 |
|---|---|
| TODO: 需要更高权限吗（如 sysadmin） | TODO |
| TODO: 什么账号满足 | TODO |

#### 2.2 危害

攻击前提：TODO: 所需权限、触发条件、是否需要额外权限。

危害（条目式，或用"危害 | 机制 | 效果"三列表）：

1. **TODO: 危害类别 1**：TODO: 描述。
2. **TODO: 危害类别 2**：TODO: 描述。
3. **TODO: 危害类别 3**：TODO: 描述。

> 可达面分层时（如 SSRF 的"容器自身 → 内网 → 宿主/云元数据 → 代理网段"四圈），可用 ASCII 分层图呈现。

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

## 五、漏洞分析

### 1. 根因：TODO: 根因简述

TODO: 根因分析——涉及的数据结构、存储形态、路径分界条件、缺陷代码形态。

```go
TODO: 相关类型定义 / 缺陷代码
```

TODO: 解释缺陷为何成立（如浅拷贝/值拷贝/别名、约束缺失），附关键代码行引用。

> 链路缺陷可用"设防机会表"呈现约束缺失的系统性（每个可设防环节 × 现状）：

| 环节 | 职责 | 约束现状 |
|---|---|---|
| TODO | TODO | TODO |

### 2. 机制展开（可选，按需增加 2.1/2.2/... 小节）

#### 2.1 TODO: 回显链 / 放大机制

TODO: 响应/错误经什么通道回到攻击者，逐环代码证据表：

| 环节 | 代码 | 作用 |
|---|---|---|
| TODO | TODO | TODO |

#### 2.2 TODO: 可达范围扩展

TODO: 扩大可达面的机制（如代理出站、重定向跟随），附代码。

## 六、漏洞复现

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

辅助靶服务（可选，环境无真实内网/云目标时）：

TODO: 起伪内部服务器/伪 CI 触发器等等效靶子（脚本 + 监听地址），说明等效证明什么。

网络拓扑（可选）：

```text
TODO: ASCII 拓扑（攻击者 → 入口 → 各组件 → 靶目标，标注 IP/端口）
```

复现参数：

| 项 | 值 |
|---|---|
| 目标版本 | TODO |
| 对外地址 | TODO |
| 管理员 / 攻击者账号 | TODO |
| 靶目标 | TODO |
| 触发载荷 | TODO |

### 2. 复现步骤：TODO: 步骤名称

> 每个步骤按此骨架展开（2..N 按需重复）。

TODO: 步骤意图——最小反例还是真实场景；实验组与对照组如何设计。

> **TODO: 术语解释（可选）**
>
> TODO: 概念定义与关键性质。

<details><summary>TODO: 文件路径</summary>

```yaml
TODO: 配置/CRD/策略文件内容
```

</details>

TODO: 规则/表达式语义解释。

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

TODO: 每步值变化表（如适用）:

| 步骤 | 求值 | TODO: 变量 | 返回值 |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

TODO: 结论——证明什么。

### 3. 复现结果（可选，多步骤总收尾）

TODO: 关键结果原文（日志/输出全文）。

| # | 确认项 | 证据 |
|---|---|---|
| TODO | TODO | TODO |

TODO: 总结——确认了什么；与真实目标的等效性说明（如无云 metadata 时以伪内部服务等效证明）。

## 七、漏洞利用

### 1. 可利用性分析

> TODO: 记号约定（如"记被作用的那个量为 x"，可选）。

**问题一（Source · 可控性）：TODO: 是否为攻击者可控输入。**

| 角色 | 控制什么 |
|---|---|
| **管理员** | TODO |
| **攻击者** | TODO |

TODO: 可控性论证（含权限下界：什么账号即可触发）。

**问题二（Trigger · 触发条件）：TODO: 取何值到达危险汇点。**

TODO: 触发条件分析——校验/gate 在哪、放行条件是什么、触发值与合法输入如何无法区分（与量级/形态解耦）。

**问题三（Impact · 危害）：到达 sink 后能造成什么危害。**

按漏洞类二选一：

- **逻辑绕过类——判定翻转方向**：应该拒绝→放行（攻击者要的）vs 应该放行→拒绝（通常无危害）；边界是否持续失效、有无第二轮检查。
- **请求/注入类（SSRF 等）——能力维度矩阵**：(1) 回显（响应能否读回、经何通道）；(2) 请求形态可控性（方法/头部/body 各自可控程度）；(3) 可达目的地（按圈分层）；(4) 部署内必存在目标。逐维组合判定哪些利用成立、哪些被阻断及原因。

**TODO: 三个问题都成立，缺陷能造成危害。** TODO: 链路完整性总结。

### 2. 利用场景

TODO: 前置说明——复现章节已实证机制，本节套到真实部署/策略上看危害落点。

每个场景按以下要素展开（2.1..2.N 按需重复；可选补充：前提条件、利用步骤、判据表、实测证据引用）：

#### 2.1 TODO: 场景名称

TODO: 场景描述。

```text
TODO: 策略表达式 / 配置 / 请求（语言按实际标记，如 cel、yaml、http）
```

- **意图**: TODO。
- **受影响写法**: TODO。
- **攻击**: TODO: 攻击者如何构造输入。
- **危害**: TODO: 翻转/命中后的具体危害。

#### 2.2 TODO: 场景名称

TODO: 场景描述。

```text
TODO: 策略表达式 / 配置 / 请求
```

- **意图**: TODO。
- **受影响写法**: TODO。
- **攻击**: TODO。
- **危害**: TODO。

---

**共性**: TODO: 各场景的共性总结——形态、攻击方式、危害落点、权限要求、触发值特征。

### 3. 漏洞利用原理图（可选）

TODO: 把攻击链各步叠在同一时间轴/数据流上（一侧系统行为，一侧底层状态），说明判定如何翻转/请求如何到达。配：

**原理要素表**（图与代码的对应）：

| 要素 | 图中位置 | 代码位置 | 作用 |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

**触发条件图**（可选）：分流图说明为何不是任意输入都触发（路径分界条件）。

**受影响写法分类**（可选）：同根因的不同触发通道。

## 八、漏洞报告

> 本节为面向上游社区的**英文提交版**（§四–§七 的英文精简；与 §九 保持同步，避免内容漂移）。子节用 `###` 三级标题（渲染器按此切卡片）。

### 1. Basic Information

| Item             | Details                                          | Note                                        |
|------------------|--------------------------------------------------|---------------------------------------------|
| NickName         | TODO: vuln-nickname                              |                                             |
| Project          | TODO: [org/repo](https://github.com/org/repo)    |                                             |
| Introduce Date   | TODO: YYYY-MM-DD                                 |                                             |
| Discovery Date   | TODO: YYYY-MM-DD                                 | optional                                    |
| Affect Version   | TODO: vX.Y.Z – vX.Y.Z                            |                                             |
| Fix Version      | TODO: vX.Y.Z / unfixed                           |                                             |
| Fix Commit       | TODO: [`sha`](https://github.com/org/repo/commit/sha) / unfixed |                  |
| Introduce Commit | TODO: [`sha`](https://github.com/org/repo/commit/sha) |                                        |
| CVSS             | TODO: 0.0 CVSS:4.0/AV:?/AC:?/AT:?/PR:?/UI:?/VC:?/VI:?/VA:?/SC:?/SI:?/SA:? | |
| Reporter         | TODO: [name (github-id: username)](https://github.com/username) |                            |

### 2. Vulnerability Introduction

#### 2.1 Description

TODO: one paragraph, condensed from §四.1 — what defect in what component/data flow, what security mechanism it defeats, how an attacker exploits it, which versions are affected.

#### 2.2 Impact

##### 2.2.1 Scope

* Affected versions: TODO (introduced by which PR/version; where the fix landed / which stable lines lack the backport; whether every released version is affected).
* Affected components/deployments: TODO (add a deployment-tier table if impact varies by deployment form).

##### 2.2.2 Harm

Attack precondition: TODO (privilege floor, trigger condition).

| Harm | Mechanism | Effect |
|---|---|---|
| TODO | TODO | TODO |

Boundaries (optional): TODO — exploits that do NOT work and why (e.g. POST-only blocks IMDS credential theft).

##### 2.2.3 CVSS

`TODO: score` CVSS:4.0/AV:?/AC:?/AT:?/PR:?/UI:?/VC:?/VI:?/VA:?/SC:?/SI:?/SA:?

| Dimension | Value | Rationale |
|---|---|---|
| TODO | TODO | TODO |

### 3. Vulnerability Analysis

TODO: root cause, condensed from §五.

```go
TODO: related type definitions / defective code
```

Chained defects (optional) — stage table:

| Stage | Code | Constraint |
|---|---|---|
| TODO | TODO | TODO |

### 4. Vulnerability Reproduction

#### 4.1 Reproduction Environment

TODO: environment link + startup commands + reproduction parameters (condensed from §六.1).

#### 4.2 Reproduction Steps and Results

TODO: condensed steps (commands + outputs).

| Case | TODO: input | Correct verdict | Observed | Conclusion |
|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO |

Confirmation table (optional):

| # | Confirmed | Evidence |
|---|---|---|
| TODO | TODO | TODO |

### 5. Vulnerability Exploitation

#### 5.1 Exploitability Analysis

* **Q1 (Source · controllability)**: TODO.
* **Q2 (Trigger · firing condition)**: TODO.
* **Q3 (Impact)**: TODO (flip direction / capability matrix).

#### 5.2 Exploitation Scenarios

##### 5.2.1 TODO: scenario name

TODO: description.

- **Intent**: TODO.
- **Affected idiom**: TODO.
- **Attack**: TODO.
- **Harm**: TODO.

### 6. Vulnerability Mitigation

#### 6.1 Fix Recommendation

上游已修复时：

| Field | Value |
|---|---|
| Commit | TODO: [`sha`](url) |
| PR | TODO: [#XXX](url) |
| Author | TODO |
| Date | TODO: YYYY-MM-DD |
| Message | TODO: commit message |
| Changes | TODO: N files, +N / −N |

TODO: 一句话建议（如 "The fix has landed in vX.Y but was not backported; we recommend assigning a CVE and backporting to the affected lines."）。

| Version | Patch | Status |
|---|---|---|
| TODO: vX.Y.x | TODO: 已合入/未合入 | TODO: fixed / vulnerable / vulnerable(EOL) |

上游未修复时，替换为建议列表：

1. **TODO**: recommendation (e.g. egress guard validating the destination after DNS resolution and pinning the IP; re-validate inside `CheckRedirect`; direct connection instead of `ProxyFromEnvironment`).

#### 6.2 Downstream Workaround

TODO: e.g. egress NetworkPolicy/firewall rules, config hardening, treating task logs as sensitive.

#### 6.3 Downstream Detection

* Version-based / PoC-based: see the "Vulnerability Reproduction" section.
* Configuration audit: TODO (audit commands).
* TODO: log/trace inspection for evidence of prior exploitation.

## 九、漏洞防护

> 上游已修复时按 1.1–1.5 写；未修复时 1.1–1.3 替换为修复建议列表（同 §八.6.1 未修复分支）。

### 1. 社区修复建议

#### 1.1 修复提交

| 项 | 值 |
|---|---|
| Commit | TODO: [`sha`](https://github.com/org/repo/commit/sha) |
| PR | TODO: [#XXX](https://github.com/org/repo/pull/XXX) `branch-name` |
| 作者 | TODO: name（`email@org`，角色） |
| 日期 | TODO: YYYY-MM-DD |
| Merge | TODO: [`sha`](https://github.com/org/repo/commit/sha) "Merge pull request ..." |
| 信息 | TODO: commit message |
| 改动 | TODO: N 文件，+N / −N |

#### 1.2 修复 diff

TODO: 修复概述——几处什么改为什么。

```diff
TODO: 修复 diff
```

修复后方法体形如（TODO: `file:line`）：

```go
TODO: 修复后代码
```

#### 1.3 TODO: 修复机制说明

TODO: 修复调用的关键方法/机制，为什么能消除缺陷。

```go
TODO: 关键方法定义
```

#### 1.4 受影响版本与补丁回溯状态

| 版本 | 补丁 | 状态 |
|---|---|---|
| TODO: vX.Y.x（≤ vX.Y.Z） | 未合入 | vulnerable(EOL) |
| TODO: vX.Y.x（≤ vX.Y.Z） | 未合入 | vulnerable |
| TODO: vX.Y.x | 已合入 | fixed |
| master | 已合入 | fixed |

> TODO: 复核日期与验证方法。

#### 1.5 回溯补丁建议

TODO: 补丁回溯状态与建议:

1. **cherry-pick 修复补丁到 TODO: 受影响分支**
2. **申请 CVE，发布漏洞公告**

### 2. 社区实际修复

截至 TODO: 复核日期 上游:

- **本缺陷**: TODO: PR / commit / 合入状态 / backport 状态 / CVE 状态。
- **同根因其他实例**: TODO: 独立修复情况。
- **已发稳定版状态**: TODO: 验证方法与结果。

TODO: 总结——印证了 §3.3.2 的判断。

### 3. 下游修复建议

面向下游发行版与嵌入相关库的第三方组件:

1. **升级到 ≥ TODO: 版本**——TODO: 说明。
2. **钉在 TODO: 版本不能跳 minor 的, cherry-pick TODO: 补丁打 patch release**——TODO: 说明。
3. bump 第三方组件 vendor 的 TODO: 依赖。

### 4. 下游规避措施

无法立即升级/重建时：

1. **增加拦截规则**: TODO: 临时加固策略及代价说明。
   ```text
   TODO: 拦截规则（CEL / NetworkPolicy / 防火墙等，语言按实际标记）
   ```
   TODO: 规则效果与代价。
2. **修改受影响配置**: TODO: 改写避免触发缺陷。
3. **回退到非 TODO: 机制**: TODO: 迁回替代方案。

### 5. 下游检测措施

#### 5.1 检测是否受影响

##### 5.1.1 部署是否带缺陷

- 基于版本检测：TODO: 版本判定方法。
- 基于PoC检测：参见"漏洞复现"章节。
- 配置审计（可选）：TODO: 审计命令/脚本。

##### 5.1.2 现有配置是否受影响

1. **导出全集群/全量 TODO: 对象**：
   ```shell
   TODO: 导出命令
   ```
2. **grep 扫特征串，缩小到候选**（命中才可能受影响）：
   ```shell
   TODO: grep 命令
   ```
   无命中 → TODO: **不受影响**，止步。
3. **在命中行里看 TODO: 特征**，受影响写法：
   - TODO: 写法 1 描述；
   - TODO: 写法 2 描述；
   - TODO: 写法 3 描述。

## 十、漏洞公告

// TODO: 等待社区
