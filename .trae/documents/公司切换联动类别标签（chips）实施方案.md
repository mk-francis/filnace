## 目标
- 顶部类别标签（chips）随“分公司”切换动态变化，只显示该公司的业务类别；在“全部分公司”仅显示“全部/收入/支出”。

## 数据来源
- 使用已存在的 `Store.getCompanyCategories(companyId)` 返回公司专属类别；当 `companyId==='all'` 返回空或不展示业务类别。

## 页面改造
- 交易页（transactions.html）
  - 将静态chips（全部/收入/支出/修车/改装/空调/零件）替换为动态渲染：
    - 容器：保留现有chips容器位置
    - 渲染函数：`renderCompanyChips(companyId)` 生成按钮列表：始终包含“全部/收入/支出”，其余从 `getCompanyCategories(companyId)` 追加
    - 事件：公司选择器变更后调用 `renderCompanyChips(companyId)`；点击chips修改当前过滤条件并触发 `filterTransactions()`
  - 过滤逻辑：
    - `全部` → 不限制类别
    - `收入/支出` → 按 `type` 过滤
    - 业务类别chips → 按 `category` 且限定在当前公司
- 仪表板（index.html）
  - 在标题下方新增chips容器，行为同交易页，跟随 `companySelector` 联动；在公司为具体值时展示该公司业务类别chips（点击时仅影响“最近交易”列表筛选，不改变图表与指标）

## 交互与样式
- 保持原有按钮样式与激活态（active）逻辑；默认选中“全部”。
- 在“全部分公司”视图下仅显示“全部/收入/支出”。

## 验证
- 切换到ABC修车行：chips显示“修车/零件/维保/空调/工资/其他”，点击能正确过滤列表
- 切换到Custom Motors PH：chips变为“改装/零件/维保/工资/其他”，过滤正确
- 切换到CoolTech空调服务：chips变为“空调安装/空调维修/设备采购/维保/工资/其他”，过滤正确
- 切回“全部分公司”：仅显示“全部/收入/支出”chips

## 交付
- 修改并提交 transactions.html 与 index.html 的chips渲染与过滤逻辑；不改数据结构