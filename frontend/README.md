# Cost-RAG Frontend

Cost-RAG 工程造价咨询智能 RAG 系统前端应用

## 🚀 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI库**: Ant Design
- **状态管理**: Redux Toolkit + RTK Query
- **路由**: React Router v6
- **样式**: Tailwind CSS + CSS Modules
- **测试**: Vitest + Testing Library
- **代码规范**: ESLint + Prettier

## 📋 功能特性

### 核心功能
- 🔐 用户认证与授权
- 📄 文档上传与处理
- 💰 成本估算计算
- 📊 多项目对比分析
- 🤖 RAG智能问答
- 🕸️ 知识图谱可视化

### UI/UX特性
- 📱 响应式设计，支持移动端
- 🌙 暗黑模式支持
- 🎨 现代化界面设计
- ⚡ 快速加载和流畅交互
- 🎯 无障碍访问支持

## 🛠️ 开发环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- 现代浏览器 (Chrome >= 90, Firefox >= 88, Safari >= 14, Edge >= 90)

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 3. 构建生产版本
```bash
npm run build
```

### 4. 预览生产构建
```bash
npm run preview
```

## 📜 脚本命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build         # 构建生产版本
npm run preview       # 预览生产构建

# 代码质量
npm run lint          # 运行 ESLint 检查
npm run lint:fix      # 自动修复 ESLint 问题

# 测试
npm run test          # 运行单元测试
npm run test:ui       # 运行测试 UI 界面
npm run test:coverage # 运行测试并生成覆盖率报告

# Storybook
npm run storybook     # 启动 Storybook
npm run build-storybook # 构建 Storybook
```

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── auth/            # 认证相关组件
│   ├── common/          # 通用组件
│   └── layout/          # 布局组件
├── hooks/               # 自定义 Hooks
├── pages/               # 页面组件
│   ├── auth/            # 认证页面
│   ├── dashboard/       # 仪表板
│   ├── documents/       # 文档管理
│   ├── estimates/       # 成本估算
│   ├── comparisons/     # 项目对比
│   ├── queries/         # 智能问答
│   ├── knowledge/       # 知识图谱
│   └── settings/        # 系统设置
├── services/            # API 服务
├── store/               # Redux 状态管理
│   ├── api/             # RTK Query API
│   └── slices/          # Redux Slices
├── styles/              # 样式文件
├── types/               # TypeScript 类型定义
├── utils/               # 工具函数
└── test/                # 测试配置
```

## 🧪 测试

项目使用 Vitest + Testing Library 进行单元测试和集成测试。

### 运行测试
```bash
# 运行所有测试
npm run test

# 监听模式运行测试
npm run test -- --watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm run test LoginForm.test.tsx
```

### 测试文件位置
- 组件测试: `src/components/**/__tests__/*.test.tsx`
- 页面测试: `src/pages/**/__tests__/*.test.tsx`
- 工具函数测试: `src/utils/__tests__/*.test.ts`

## 🎨 主题和样式

### Tailwind CSS 配置
项目使用 Tailwind CSS 进行样式开发，配置文件位于 `tailwind.config.js`。

### CSS 变量
项目定义了完整的设计系统变量，支持主题切换。

### 暗黑模式
支持系统级暗黑模式切换，用户也可以手动切换。

## 🔧 配置文件

### 环境变量
- `.env.example` - 环境变量模板
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置

### 构建配置
- `vite.config.ts` - Vite 构建配置
- `tsconfig.json` - TypeScript 配置
- `postcss.config.js` - PostCSS 配置

### 代码规范
- `.eslintrc.json` - ESLint 配置
- `.prettierrc` - Prettier 配置

## 📊 性能优化

### 代码分割
- 路由级别的代码分割
- 第三方库的按需加载
- 组件级别的懒加载

### 构建优化
- Tree shaking 移除未使用代码
- 资源压缩和优化
- 浏览器缓存策略

### 运行时优化
- React.memo 和 useMemo 优化
- 图片懒加载
- 虚拟滚动（大列表）

## 🔒 安全性

- XSS 防护
- CSRF 防护
- 内容安全策略 (CSP)
- 输入验证和清理
- 安全的 API 调用

## 🌐 浏览器支持

| Browser | Version |
|---------|---------|
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

## 📝 开发规范

### 代码风格
- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 配置
- 组件使用函数式组件 + Hooks
- 使用 CSS Modules 或 Tailwind CSS

### Git 提交规范
```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

### 分支管理
- `main` - 主分支，用于生产环境
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 热修复分支

## 🚀 部署

### 构建命令
```bash
npm run build
```

### 部署目录
构建后的文件位于 `dist/` 目录，可以部署到任何静态文件服务器。

### 环境变量
生产环境需要配置相应的环境变量，参考 `.env.example`。

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📞 技术支持

- 项目文档: [项目 Wiki](https://github.com/your-org/cost-rag-frontend/wiki)
- 问题反馈: [Issues](https://github.com/your-org/cost-rag-frontend/issues)
- 技术支持: support@cost-rag.com

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！