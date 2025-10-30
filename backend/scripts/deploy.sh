#!/bin/bash

# Cost-RAG 后端部署脚本
# 使用方法: ./deploy.sh [环境] [选项]
# 环境: dev, staging, production
# 选项: --build, --migrate, --seed, --monitoring

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "Cost-RAG 后端部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [环境] [选项]"
    echo ""
    echo "环境:"
    echo "  dev         开发环境"
    echo "  staging     测试环境"
    echo "  production  生产环境"
    echo ""
    echo "选项:"
    echo "  --build     重新构建Docker镜像"
    echo "  --migrate   运行数据库迁移"
    echo "  --seed      初始化数据"
    echo "  --monitoring 部署监控服务"
    echo "  --help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev --build --migrate --seed"
    echo "  $0 production --monitoring"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi

    # 检查环境文件
    if [ ! -f ".env.${ENV}" ]; then
        log_warning "环境文件 .env.${ENV} 不存在，使用默认配置"
        if [ ! -f ".env" ]; then
            log_error "默认环境文件 .env 不存在"
            exit 1
        fi
    fi

    log_success "依赖检查完成"
}

# 设置环境变量
setup_environment() {
    log_info "设置 ${ENV} 环境..."

    case $ENV in
        dev)
            export COMPOSE_FILE="docker-compose.yml:docker-compose.dev.yml"
            export ENVIRONMENT="development"
            ;;
        staging)
            export COMPOSE_FILE="docker-compose.yml:docker-compose.staging.yml"
            export ENVIRONMENT="staging"
            ;;
        production)
            export COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml"
            export ENVIRONMENT="production"
            ;;
        *)
            log_error "无效的环境: $ENV"
            show_help
            exit 1
            ;;
    esac

    # 复制环境文件
    if [ -f ".env.${ENV}" ]; then
        cp ".env.${ENV}" .env
        log_info "使用环境配置文件: .env.${ENV}"
    fi

    log_success "环境设置完成"
}

# 构建镜像
build_images() {
    if [ "$BUILD" = "true" ]; then
        log_info "构建Docker镜像..."

        # 构建后端镜像
        docker-compose build backend

        log_success "镜像构建完成"
    fi
}

# 启动基础服务
start_infrastructure() {
    log_info "启动基础设施服务..."

    # 启动数据库和缓存服务
    docker-compose up -d postgres redis neo4j qdrant

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10

    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_success "基础设施服务启动成功"
    else
        log_error "基础设施服务启动失败"
        docker-compose logs
        exit 1
    fi
}

# 运行数据库迁移
run_migrations() {
    if [ "$MIGRATE" = "true" ]; then
        log_info "运行数据库迁移..."

        # 等待数据库就绪
        log_info "等待数据库就绪..."
        sleep 5

        # 运行迁移
        docker-compose run --rm backend python -m alembic upgrade head

        log_success "数据库迁移完成"
    fi
}

# 初始化数据
seed_data() {
    if [ "$SEED" = "true" ]; then
        log_info "初始化数据..."

        # 运行数据初始化脚本
        docker-compose run --rm backend python scripts/seed_data.py

        log_success "数据初始化完成"
    fi
}

# 启动应用服务
start_application() {
    log_info "启动应用服务..."

    # 启动后端API
    docker-compose up -d backend

    # 等待应用启动
    log_info "等待应用启动..."
    sleep 10

    # 健康检查
    if curl -f http://localhost:8000/health &> /dev/null; then
        log_success "应用启动成功"
    else
        log_error "应用启动失败"
        docker-compose logs backend
        exit 1
    fi
}

# 部署监控服务
deploy_monitoring() {
    if [ "$MONITORING" = "true" ]; then
        log_info "部署监控服务..."

        # 启动监控服务
        docker-compose up -d prometheus grafana

        log_success "监控服务部署完成"
        log_info "Prometheus: http://localhost:9090"
        log_info "Grafana: http://localhost:3001 (admin/admin)"
    fi
}

# 生成API文档
generate_docs() {
    log_info "生成API文档..."

    # 生成OpenAPI文档
    docker-compose run --rm backend python scripts/generate_docs.py

    log_success "API文档生成完成"
}

# 运行测试
run_tests() {
    if [ "$ENV" = "dev" ] || [ "$ENV" = "staging" ]; then
        log_info "运行测试..."

        # 运行单元测试
        docker-compose run --rm backend python -m pytest tests/unit/ -v

        # 运行集成测试
        docker-compose run --rm backend python -m pytest tests/integration/ -v

        log_success "测试完成"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_success "🎉 Cost-RAG 后端部署完成!"
    echo ""
    echo "环境: $ENV"
    echo "应用地址: http://localhost:8000"
    echo "API文档: http://localhost:8000/docs"
    echo "ReDoc: http://localhost:8000/redoc"
    echo ""

    if [ "$MONITORING" = "true" ]; then
        echo "监控服务:"
        echo "  Prometheus: http://localhost:9090"
        echo "  Grafana: http://localhost:3001 (admin/admin)"
        echo ""
    fi

    echo "数据库连接:"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    echo "  Neo4j: localhost:7474"
    echo "  Qdrant: localhost:6333"
    echo ""

    echo "管理命令:"
    echo "  查看日志: docker-compose logs -f [service]"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart [service]"
}

# 清理函数
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "部署过程中出现错误，正在清理..."
        docker-compose down
    fi
}

# 主函数
main() {
    # 设置错误处理
    trap cleanup EXIT

    # 解析参数
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi

    ENV="$1"
    BUILD="false"
    MIGRATE="false"
    SEED="false"
    MONITORING="false"

    shift
    while [ $# -gt 0 ]; do
        case $1 in
            --build)
                BUILD="true"
                ;;
            --migrate)
                MIGRATE="true"
                ;;
            --seed)
                SEED="true"
                ;;
            --monitoring)
                MONITORING="true"
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done

    # 开始部署流程
    log_info "开始部署 Cost-RAG 后端服务..."

    check_dependencies
    setup_environment
    build_images
    start_infrastructure
    run_migrations
    seed_data
    start_application
    deploy_monitoring
    generate_docs

    if [ "$ENV" != "production" ]; then
        run_tests
    fi

    show_deployment_info

    # 移除错误处理
    trap - EXIT
}

# 执行主函数
main "$@"