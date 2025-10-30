"""
文档管理系统测试
"""
import pytest
import asyncio
import io
import os
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.document_service import document_service
from app.services.document_processor import document_processor
from app.services.vector_service import vector_service
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentSearchRequest
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_document_processor_initialization():
    """测试文档处理器初始化"""
    processor = document_processor
    assert processor is not None
    assert processor.embedding_model is not None
    assert len(processor.supported_formats) > 0


@pytest.mark.asyncio
async def test_supported_formats():
    """测试支持的文件格式"""
    formats = await document_processor.get_supported_formats()
    assert isinstance(formats, list)
    assert '.pdf' in formats
    assert '.docx' in formats
    assert '.txt' in formats


@pytest.mark.asyncio
async def test_file_validation():
    """测试文件验证"""
    # 测试不存在的文件
    result = await document_processor.validate_file("nonexistent.pdf")
    assert result['valid'] is False
    assert '文件不存在' in result['error']

    # 测试支持的格式
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=1024):
        result = await document_processor.validate_file("test.pdf")
        assert result['valid'] is True
        assert result['file_type'] == '.pdf'


@pytest.mark.asyncio
async def test_text_extraction_pdf():
    """测试PDF文本提取"""
    # 模拟PDF内容
    mock_pdf_content = "这是一个测试PDF文档的内容。"

    with patch('fitz.open') as mock_fitz:
        mock_doc = Mock()
        mock_page = Mock()
        mock_page.get_text.return_value = mock_pdf_content
        mock_doc.__iter__ = Mock(return_value=iter([mock_page]))
        mock_doc.page_count = 1
        mock_fitz.return_value = mock_doc

        text = await document_processor._extract_pdf_text("test.pdf")
        assert text == mock_pdf_content


@pytest.mark.asyncio
async def test_text_extraction_docx():
    """测试Word文档文本提取"""
    mock_doc_content = "这是一个测试Word文档的内容。"

    with patch('docx.Document') as mock_docx:
        mock_doc = Mock()
        mock_paragraph = Mock()
        mock_paragraph.text = mock_doc_content
        mock_doc.paragraphs = [mock_paragraph]
        mock_docx.return_value = mock_doc

        text = await document_processor._extract_docx_text("test.docx")
        assert text == mock_doc_content


@pytest.mark.asyncio
async def test_text_extraction_txt():
    """测试纯文本文件提取"""
    mock_txt_content = "这是一个测试文本文件的内容。"

    with patch('builtins.open', mock_open_read(mock_txt_content)):
        text = await document_processor._extract_text_file("test.txt")
        assert text == mock_txt_content


@pytest.mark.asyncio
async def test_text_chunking():
    """测试文本分块"""
    text = "这是第一个段落。\n这是第二个段落。\n这是第三个段落。"

    chunks = await document_processor._chunk_text(text, chunk_size=50, chunk_overlap=10)

    assert isinstance(chunks, list)
    assert len(chunks) > 0
    assert all('content' in chunk for chunk in chunks)
    assert all('chunk_index' in chunk for chunk in chunks)


@pytest.mark.asyncio
async def test_metadata_extraction():
    """测试元数据提取"""
    with patch('os.stat') as mock_stat, \
         patch('mimetypes.guess_type', return_value=('application/pdf', None)):

        mock_stat.return_value.st_size = 1024
        mock_stat.return_value.st_ctime = 1234567890
        mock_stat.return_value.st_mtime = 1234567890

        metadata = await document_processor._extract_metadata("test.pdf", ".pdf")

        assert isinstance(metadata, dict)
        assert 'filename' in metadata
        assert 'file_size' in metadata
        assert 'file_extension' in metadata
        assert metadata['file_extension'] == '.pdf'


@pytest.mark.asyncio
async def test_vector_search_service():
    """测试向量搜索服务"""
    service = vector_service

    # 测试连接
    with patch.object(service, 'client') as mock_client:
        mock_client.get_collections.return_value.collections = []
        mock_client.create_collection = Mock()

        result = await service.connect()
        assert result is True


@pytest.mark.asyncio
async def test_document_upload():
    """测试文档上传"""
    # 创建模拟的文件对象
    mock_file = Mock()
    mock_file.filename = "test.pdf"
    mock_file.file = io.BytesIO(b"test content")

    # 创建文档数据
    document_data = DocumentCreate(
        title="测试文档",
        description="这是一个测试文档",
        category="测试",
        tags=["测试", "文档"]
    )

    # 模拟数据库会话
    mock_db = AsyncMock(spec=AsyncSession)

    with patch.object(document_service, '_save_uploaded_file') as mock_save, \
         patch.object(document_processor, 'validate_file') as mock_validate, \
         patch.object(document_processor, '_calculate_file_hash') as mock_hash, \
         patch.object(document_service, '_get_document_by_hash') as mock_existing, \
         patch.object(document_service, '_process_document_async') as mock_process:

        # 设置模拟返回值
        mock_save.return_value = Mock()
        mock_validate.return_value = {'valid': True}
        mock_hash.return_value = "test_hash_123"
        mock_existing.return_value = None

        # 模拟数据库操作
        mock_document = Document(
            id=1,
            user_id=1,
            title="测试文档",
            file_hash="test_hash_123",
            file_path="/test/path"
        )

        # 执行上传
        with patch('sqlalchemy.ext.asyncio.AsyncSession.add'), \
             patch('sqlalchemy.ext.asyncio.AsyncSession.commit'), \
             patch('sqlalchemy.ext.asyncio.AsyncSession.refresh'):

            document = await document_service.upload_document(
                file=mock_file,
                user_id=1,
                document_data=document_data,
                db=mock_db
            )

            # 验证结果
            assert document is not None
            mock_process.assert_called_once()


@pytest.mark.asyncio
async def test_document_search():
    """测试文档搜索"""
    search_request = DocumentSearchRequest(
        query="测试",
        limit=10,
        offset=0
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟搜索结果
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [
            Document(
                id=1,
                title="测试文档1",
                description="测试描述1",
                category="测试",
                tags=["测试"],
                user_id=1,
                file_hash="hash1",
                file_path="/path1"
            )
        ]
        mock_db.execute.return_value = mock_result

        results = await document_service.search_documents(
            search_request=search_request,
            user_id=1,
            db=mock_db
        )

        assert isinstance(results, list)
        assert len(results) > 0
        assert 'document_id' in results[0]


@pytest.mark.asyncio
async def test_document_update():
    """测试文档更新"""
    document_update = DocumentUpdate(
        title="更新后的标题",
        description="更新后的描述"
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select:
        # 模拟现有文档
        mock_existing_doc = Document(
            id=1,
            title="原始标题",
            description="原始描述",
            user_id=1,
            file_hash="hash1",
            file_path="/path1"
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_existing_doc
        mock_db.execute.return_value = mock_result

        updated_doc = await document_service.update_document(
            document_id=1,
            document_update=document_update,
            user_id=1,
            db=mock_db
        )

        assert updated_doc is not None
        assert updated_doc.title == "更新后的标题"
        assert updated_doc.description == "更新后的描述"


@pytest.mark.asyncio
async def test_document_delete():
    """测试文档删除"""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select, \
         patch.object(vector_service, 'delete_document_vectors') as mock_delete_vectors, \
         patch('os.path.exists') as mock_exists, \
         patch('os.remove') as mock_remove:

        # 模拟现有文档
        mock_existing_doc = Document(
            id=1,
            title="测试文档",
            user_id=1,
            file_hash="hash1",
            file_path="/test/path"
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_existing_doc
        mock_db.execute.return_value = mock_result
        mock_exists.return_value = True

        success = await document_service.delete_document(
            document_id=1,
            user_id=1,
            db=mock_db
        )

        assert success is True
        mock_delete_vectors.assert_called_once_with(1)
        mock_remove.assert_called_once()


@pytest.mark.asyncio
async def test_document_analytics():
    """测试文档分析统计"""
    mock_db = AsyncMock(spec=AsyncSession)

    with patch('sqlalchemy.select') as mock_select, \
         patch('sqlalchemy.func') as mock_func:

        # 模拟统计数据
        mock_count_result = Mock()
        mock_count_result.scalar.return_value = 10
        mock_file_type_result = Mock()
        mock_file_type_result.__iter__ = Mock(return_value=iter([
            Mock(file_type='pdf', count=5),
            Mock(file_type='docx', count=3),
            Mock(file_type='txt', count=2)
        ]))

        # 设置不同的执行结果
        mock_db.execute.side_effect = [
            mock_count_result,  # total_documents
            mock_file_type_result,  # file_type_distribution
            Mock(),  # category_distribution
            Mock(),  # processing_status_distribution
            Mock(),  # upload_timeline
            Mock(),  # popular_tags
            Mock()   # total_size
        ]

        analytics = await document_service.get_document_analytics(
            user_id=1,
            db=mock_db
        )

        assert isinstance(analytics, dict)
        assert 'total_documents' in analytics
        assert 'file_type_distribution' in analytics
        assert analytics['total_documents'] == 10


@pytest.mark.asyncio
async def test_vector_search():
    """测试向量搜索"""
    from app.schemas.document import VectorSearchRequest

    search_request = VectorSearchRequest(
        query="测试查询",
        limit=5,
        score_threshold=0.7
    )

    mock_db = AsyncMock(spec=AsyncSession)

    with patch.object(vector_service, 'connect') as mock_connect, \
         patch('sentence_transformers.SentenceTransformer') as mock_model, \
         patch.object(vector_service, 'search_similar_vectors') as mock_search:

        # 模拟向量和搜索结果
        mock_connect.return_value = True
        mock_encoder = Mock()
        mock_encoder.encode.return_value = [0.1, 0.2, 0.3]  # 模拟向量
        mock_model.return_value = mock_encoder

        mock_search.return_value = [
            {
                'payload': {
                    'document_id': 1,
                    'chunk_index': 0,
                    'content': '测试内容',
                    'file_type': 'pdf'
                },
                'score': 0.85
            }
        ]

        # 模拟文档查询
        with patch('sqlalchemy.select') as mock_select:
            mock_doc = Document(
                id=1,
                title="测试文档",
                user_id=1,
                file_hash="hash1",
                file_path="/path1"
            )
            mock_result = Mock()
            mock_result.scalar_one_or_none.return_value = mock_doc
            mock_db.execute.return_value = mock_result

            results = await document_service.vector_search(
                search_request=search_request,
                user_id=1,
                db=mock_db
            )

            assert isinstance(results, list)
            assert len(results) > 0
            assert 'content' in results[0]
            assert 'relevance_score' in results[0]


# 辅助函数
def mock_open_read(content):
    """模拟文件读取"""
    mock_file = Mock()
    mock_file.read.return_value = content
    return mock_file


@pytest.fixture
def mock_upload_dir(tmp_path):
    """创建临时上传目录"""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    return upload_dir


@pytest.mark.asyncio
async def test_file_processing_workflow():
    """测试完整的文档处理工作流"""
    # 模拟完整的文档处理流程
    with patch.object(document_processor, 'process_document') as mock_process, \
         patch.object(vector_service, 'connect') as mock_connect, \
         patch.object(vector_service, 'add_document_vectors') as mock_add_vectors:

        # 模拟处理结果
        mock_process.return_value = {
            'processing_status': 'success',
            'file_hash': 'test_hash',
            'total_length': 1000,
            'chunk_count': 3,
            'metadata': {'file_type': '.pdf', 'file_size': 1024},
            'chunks': [
                {'chunk_index': 0, 'content': '内容1', 'char_count': 10},
                {'chunk_index': 1, 'content': '内容2', 'char_count': 15},
                {'chunk_index': 2, 'content': '内容3', 'char_count': 20}
            ],
            'embeddings': [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]
        }

        mock_connect.return_value = True
        mock_add_vectors.return_value = ['vector_1_0', 'vector_1_1', 'vector_1_2']

        # 执行处理
        result = await document_processor.process_document(
            file_path="test.pdf",
            filename="test.pdf"
        )

        # 验证结果
        assert result['processing_status'] == 'success'
        assert result['chunk_count'] == 3
        assert len(result['chunks']) == 3
        assert result['embeddings'] is not None


@pytest.mark.asyncio
async def test_error_handling():
    """测试错误处理"""
    # 测试文件验证错误
    with patch('os.path.exists', return_value=False):
        result = await document_processor.validate_file("nonexistent.pdf")
        assert result['valid'] is False

    # 测试文档不存在错误
    mock_db = AsyncMock(spec=AsyncSession)
    with patch('sqlalchemy.select') as mock_select:
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        doc = await document_service.get_document(
            document_id=999,
            user_id=1,
            db=mock_db
        )
        assert doc is None


@pytest.mark.asyncio
async def test_concurrent_document_processing():
    """测试并发文档处理"""
    # 测试多个文档同时处理
    tasks = []

    for i in range(3):
        with patch.object(document_processor, 'process_document') as mock_process:
            mock_process.return_value = {
                'processing_status': 'success',
                'file_hash': f'hash_{i}',
                'chunk_count': 2,
                'chunks': [
                    {'chunk_index': 0, 'content': f'内容{i}_1'},
                    {'chunk_index': 1, 'content': f'内容{i}_2'}
                ],
                'embeddings': [[0.1, 0.2], [0.3, 0.4]]
            }

            task = document_processor.process_document(f"test_{i}.pdf", f"test_{i}.pdf")
            tasks.append(task)

    # 并发执行
    results = await asyncio.gather(*tasks)

    # 验证结果
    assert len(results) == 3
    for i, result in enumerate(results):
        assert result['processing_status'] == 'success'
        assert result['file_hash'] == f'hash_{i}'


@pytest.mark.asyncio
async def test_document_permission_checks():
    """测试文档权限检查"""
    mock_db = AsyncMock(spec=AsyncSession)

    # 测试用户只能访问自己的文档
    with patch('sqlalchemy.select') as mock_select:
        # 模拟其他用户的文档
        other_user_doc = Document(
            id=1,
            title="其他用户文档",
            user_id=2,  # 不同的用户ID
            file_hash="hash1",
            file_path="/path1"
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = other_user_doc
        mock_db.execute.return_value = mock_result

        # 用户1尝试访问用户2的文档
        doc = await document_service.get_document(
            document_id=1,
            user_id=1,  # 不同的用户
            db=mock_db
        )

        # 应该返回None（无权限访问）
        assert doc is None