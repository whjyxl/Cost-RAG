"""
文档处理服务模块
"""
import os
import io
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional, List, Dict, Any, BinaryIO
import PyPDF2
import docx
import pandas as pd
from pptx import Presentation
import fitz  # PyMuPDF
from PIL import Image
import markdown
from bs4 import BeautifulSoup
import textract
from sentence_transformers import SentenceTransformer
import numpy as np
from app.core.config import settings
from app.core.logging import logger


class DocumentProcessor:
    """文档处理器 - 支持多种格式的文档解析和向量化"""

    def __init__(self):
        # 初始化向量化模型
        self.embedding_model = SentenceTransformer('shibing624/text2vec-base-chinese')
        self.supported_formats = {
            '.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm',
            '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.jpg', '.jpeg',
            '.png', '.gif', '.bmp', '.tiff'
        }

    async def process_document(
        self,
        file_path: str,
        filename: str,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> Dict[str, Any]:
        """
        处理文档并生成向量

        Args:
            file_path: 文件路径
            filename: 文件名
            chunk_size: 分块大小
            chunk_overlap: 分块重叠

        Returns:
            处理结果字典
        """
        try:
            # 1. 检测文件类型
            file_ext = Path(filename).suffix.lower()
            if file_ext not in self.supported_formats:
                raise ValueError(f"不支持的文件格式: {file_ext}")

            # 2. 计算文件哈希
            file_hash = await self._calculate_file_hash(file_path)

            # 3. 提取文本内容
            text_content = await self._extract_text(file_path, file_ext)

            # 4. 提取元数据
            metadata = await self._extract_metadata(file_path, file_ext)

            # 5. 文本分块
            chunks = await self._chunk_text(
                text_content,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            # 6. 生成向量
            embeddings = await self._generate_embeddings(chunks)

            # 7. 处理结果
            result = {
                'file_hash': file_hash,
                'file_type': file_ext,
                'total_length': len(text_content),
                'chunk_count': len(chunks),
                'metadata': metadata,
                'chunks': chunks,
                'embeddings': embeddings.tolist() if embeddings is not None else None,
                'processing_status': 'success'
            }

            logger.info(f"文档处理完成: {filename}, 分块数: {len(chunks)}")
            return result

        except Exception as e:
            logger.error(f"文档处理失败 {filename}: {str(e)}")
            return {
                'processing_status': 'error',
                'error_message': str(e),
                'file_hash': None,
                'chunks': [],
                'embeddings': None
            }

    async def _calculate_file_hash(self, file_path: str) -> str:
        """计算文件哈希值"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    async def _extract_text(self, file_path: str, file_ext: str) -> str:
        """根据文件类型提取文本"""
        try:
            if file_ext == '.pdf':
                return await self._extract_pdf_text(file_path)
            elif file_ext in ['.docx', '.doc']:
                return await self._extract_docx_text(file_path)
            elif file_ext in ['.txt', '.md']:
                return await self._extract_text_file(file_path)
            elif file_ext in ['.html', '.htm']:
                return await self._extract_html_text(file_path)
            elif file_ext in ['.xlsx', '.xls']:
                return await self._extract_excel_text(file_path)
            elif file_ext == '.csv':
                return await self._extract_csv_text(file_path)
            elif file_ext in ['.pptx', '.ppt']:
                return await self._extract_pptx_text(file_path)
            elif file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']:
                return await self._extract_image_text(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_ext}")
        except Exception as e:
            logger.error(f"文本提取失败 {file_path}: {str(e)}")
            raise

    async def _extract_pdf_text(self, file_path: str) -> str:
        """提取PDF文本 - 使用PyMuPDF"""
        try:
            doc = fitz.open(file_path)
            text = ""
            for page_num in range(doc.page_count):
                page = doc[page_num]
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            logger.error(f"PDF文本提取失败: {str(e)}")
            # 备用方案：使用PyPDF2
            try:
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text()
                return text.strip()
            except:
                raise ValueError(f"无法解析PDF文件: {file_path}")

    async def _extract_docx_text(self, file_path: str) -> str:
        """提取Word文档文本"""
        try:
            doc = docx.Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Word文档文本提取失败: {str(e)}")
            raise

    async def _extract_text_file(self, file_path: str) -> str:
        """提取纯文本文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read().strip()
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                with open(file_path, 'r', encoding='gbk') as file:
                    return file.read().strip()
            except:
                with open(file_path, 'r', encoding='latin-1') as file:
                    return file.read().strip()

    async def _extract_html_text(self, file_path: str) -> str:
        """提取HTML文本"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                html_content = file.read()
            soup = BeautifulSoup(html_content, 'html.parser')
            return soup.get_text(separator='\n', strip=True)
        except Exception as e:
            logger.error(f"HTML文本提取失败: {str(e)}")
            raise

    async def _extract_excel_text(self, file_path: str) -> str:
        """提取Excel文本"""
        try:
            df = pd.read_excel(file_path)
            text = ""
            for index, row in df.iterrows():
                row_text = "\t".join([str(cell) if pd.notna(cell) else "" for cell in row])
                text += row_text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Excel文本提取失败: {str(e)}")
            raise

    async def _extract_csv_text(self, file_path: str) -> str:
        """提取CSV文本"""
        try:
            df = pd.read_csv(file_path)
            text = df.to_string(index=False)
            return text.strip()
        except Exception as e:
            logger.error(f"CSV文本提取失败: {str(e)}")
            raise

    async def _extract_pptx_text(self, file_path: str) -> str:
        """提取PowerPoint文本"""
        try:
            prs = Presentation(file_path)
            text = ""
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text += shape.text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"PowerPoint文本提取失败: {str(e)}")
            raise

    async def _extract_image_text(self, file_path: str) -> str:
        """提取图片文本（OCR）- 简化版本"""
        try:
            # 这里可以集成OCR服务如Tesseract或云OCR API
            # 目前返回文件名作为占位符
            filename = Path(file_path).name
            return f"[图片文件: {filename} - 需要OCR识别]"
        except Exception as e:
            logger.error(f"图片文本提取失败: {str(e)}")
            raise

    async def _extract_metadata(self, file_path: str, file_ext: str) -> Dict[str, Any]:
        """提取文档元数据"""
        try:
            file_stat = os.stat(file_path)
            metadata = {
                'filename': Path(file_path).name,
                'file_size': file_stat.st_size,
                'created_time': file_stat.st_ctime,
                'modified_time': file_stat.st_mtime,
                'mime_type': mimetypes.guess_type(file_path)[0],
                'file_extension': file_ext
            }

            # 特定格式的额外元数据
            if file_ext == '.pdf':
                try:
                    doc = fitz.open(file_path)
                    metadata.update({
                        'page_count': doc.page_count,
                        'pdf_version': doc.pdf_version(),
                        'title': doc.metadata.get('title', ''),
                        'author': doc.metadata.get('author', ''),
                        'subject': doc.metadata.get('subject', ''),
                        'creator': doc.metadata.get('creator', ''),
                        'producer': doc.metadata.get('producer', ''),
                        'creation_date': doc.metadata.get('creationDate', ''),
                        'modification_date': doc.metadata.get('modDate', '')
                    })
                    doc.close()
                except:
                    pass
            elif file_ext == '.docx':
                try:
                    doc = docx.Document(file_path)
                    metadata.update({
                        'paragraph_count': len(doc.paragraphs),
                        'word_count': len(doc.paragraphs) * 10,  # 估算
                        'author': doc.core_properties.author or '',
                        'title': doc.core_properties.title or '',
                        'subject': doc.core_properties.subject or '',
                        'created': doc.core_properties.created,
                        'modified': doc.core_properties.modified
                    })
                except:
                    pass
            elif file_ext in ['.xlsx', '.xls']:
                try:
                    df = pd.read_excel(file_path)
                    metadata.update({
                        'row_count': len(df),
                        'column_count': len(df.columns),
                        'sheet_names': ['Sheet1']  # 简化版本
                    })
                except:
                    pass
            elif file_ext == '.csv':
                try:
                    df = pd.read_csv(file_path)
                    metadata.update({
                        'row_count': len(df),
                        'column_count': len(df.columns),
                        'has_header': True  # 默认假设有标题
                    })
                except:
                    pass

            return metadata

        except Exception as e:
            logger.error(f"元数据提取失败: {str(e)}")
            return {
                'filename': Path(file_path).name,
                'file_extension': file_ext,
                'error': str(e)
            }

    async def _chunk_text(
        self,
        text: str,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> List[Dict[str, Any]]:
        """文本分块"""
        if not text.strip():
            return []

        chunks = []
        text_length = len(text)

        # 按段落分割
        paragraphs = text.split('\n')
        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # 如果当前块加上新段落不超过大小限制
            if len(current_chunk) + len(para) + 1 <= chunk_size:
                if current_chunk:
                    current_chunk += "\n" + para
                else:
                    current_chunk = para
            else:
                # 保存当前块
                if current_chunk:
                    chunks.append({
                        'chunk_index': chunk_index,
                        'content': current_chunk.strip(),
                        'start_position': sum(len(c['content']) for c in chunks),
                        'end_position': sum(len(c['content']) for c in chunks) + len(current_chunk),
                        'word_count': len(current_chunk.split()),
                        'char_count': len(current_chunk)
                    })
                    chunk_index += 1

                # 开始新块
                current_chunk = para

                # 如果单个段落太长，需要进一步分割
                if len(para) > chunk_size:
                    words = para.split()
                    temp_chunk = ""
                    for word in words:
                        if len(temp_chunk) + len(word) + 1 <= chunk_size:
                            if temp_chunk:
                                temp_chunk += " " + word
                            else:
                                temp_chunk = word
                        else:
                            if temp_chunk:
                                chunks.append({
                                    'chunk_index': chunk_index,
                                    'content': temp_chunk.strip(),
                                    'start_position': sum(len(c['content']) for c in chunks),
                                    'end_position': sum(len(c['content']) for c in chunks) + len(temp_chunk),
                                    'word_count': len(temp_chunk.split()),
                                    'char_count': len(temp_chunk)
                                })
                                chunk_index += 1
                            temp_chunk = word
                    current_chunk = temp_chunk

        # 处理最后一个块
        if current_chunk:
            chunks.append({
                'chunk_index': chunk_index,
                'content': current_chunk.strip(),
                'start_position': sum(len(c['content']) for c in chunks),
                'end_position': sum(len(c['content']) for c in chunks) + len(current_chunk),
                'word_count': len(current_chunk.split()),
                'char_count': len(current_chunk)
            })

        # 添加重叠信息
        for i, chunk in enumerate(chunks):
            if i > 0:
                chunk['previous_chunk_overlap'] = chunks[i-1]['content'][-chunk_overlap:] if len(chunks[i-1]['content']) > chunk_overlap else chunks[i-1]['content']
            if i < len(chunks) - 1:
                chunk['next_chunk_overlap'] = chunks[i+1]['content'][:chunk_overlap] if len(chunks[i+1]['content']) > chunk_overlap else chunks[i+1]['content']

        return chunks

    async def _generate_embeddings(self, chunks: List[Dict[str, Any]]) -> Optional[np.ndarray]:
        """生成文本向量"""
        try:
            if not chunks:
                return None

            texts = [chunk['content'] for chunk in chunks]
            embeddings = self.embedding_model.encode(texts)

            logger.info(f"生成 {len(embeddings)} 个向量，维度: {embeddings.shape[1]}")
            return embeddings

        except Exception as e:
            logger.error(f"向量生成失败: {str(e)}")
            return None

    async def get_supported_formats(self) -> List[str]:
        """获取支持的文件格式列表"""
        return list(self.supported_formats)

    async def validate_file(self, file_path: str, max_size_mb: int = 100) -> Dict[str, Any]:
        """验证文件是否符合处理要求"""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': '文件不存在'}

            file_size = os.path.getsize(file_path)
            max_size_bytes = max_size_mb * 1024 * 1024

            if file_size > max_size_bytes:
                return {
                    'valid': False,
                    'error': f'文件大小超过限制 ({max_size_mb}MB)'
                }

            file_ext = Path(file_path).suffix.lower()
            if file_ext not in self.supported_formats:
                return {
                    'valid': False,
                    'error': f'不支持的文件格式: {file_ext}'
                }

            return {
                'valid': True,
                'file_size': file_size,
                'file_type': file_ext,
                'estimated_processing_time': file_size / (1024 * 1024) * 2  # 估算处理时间
            }

        except Exception as e:
            return {'valid': False, 'error': str(e)}


# 全局文档处理器实例
document_processor = DocumentProcessor()