function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

loadScript(chrome.runtime.getURL('lib/pdf-lib.min.js'))
    .then(() => {
        console.log('pdf-lib.min.js loaded successfully');
        initApp();
    })
    .catch(error => {
        console.error('Failed to load pdf-lib.min.js', error);
    });

function initApp() {
    document.addEventListener('DOMContentLoaded', function() {
        const pdfInput = document.getElementById('pdfInput');
        const mergeButton = document.getElementById('mergeButton');
        const splitPdfInput = document.getElementById('splitPdfInput');
        const splitButton = document.getElementById('splitButton');
        const statusDiv = document.getElementById('status');
        const progressContainer = document.getElementById('progressContainer');
        const fileList = document.getElementById('fileList');
        const outputFileName = document.getElementById('outputFileName');
        const splitFileInfo = document.getElementById('splitFileInfo');
        const pageRange = document.getElementById('pageRange');

        let selectedFiles = [];
        let splitPdfFile = null;

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(`${tabName}Tab`).classList.add('active');
            });
        });

        // Merge PDF functionality
        pdfInput.addEventListener('change', updateFileList);
        mergeButton.addEventListener('click', mergePDFs);

        // Split PDF functionality
        splitPdfInput.addEventListener('change', async function() {
            const file = this.files[0];
            if (file) {
                selectedSplitFile = file; // 保存选中的文件
                try {
                    const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
                    const pageCount = pdfDoc.getPageCount();
                    splitFileInfo.textContent = `文件名: ${file.name}, 总页数: ${pageCount}`;
                } catch (error) {
                    console.error('读取PDF文件失败:', error);
                    splitFileInfo.textContent = '读取PDF文件失败';
                    selectedSplitFile = null; // 重置选中的文件
                }
            } else {
                splitFileInfo.textContent = '';
                selectedSplitFile = null; // 重置选中的文件
            }
        });
        splitButton.addEventListener('click', async function() {
            if (!selectedSplitFile) {
                statusDiv.textContent = '请选择要分隔的PDF文件';
                return;
            }

            const range = pageRange.value.trim();
            if (!range) {
                statusDiv.textContent = '请输入要提取的页面范围';
                return;
            }

            statusDiv.textContent = '正在分隔PDF文件...';
            progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                const pdfBytes = await readFileAsArrayBuffer(selectedSplitFile);
                const pdf = await PDFLib.PDFDocument.load(pdfBytes);
                const newPdf = await PDFLib.PDFDocument.create();
                const pages = parsePageRange(range, pdf.getPageCount());

                for (let i = 0; i < pages.length; i++) {
                    const [copiedPage] = await newPdf.copyPages(pdf, [pages[i] - 1]);
                    newPdf.addPage(copiedPage);
                    updateProgress((i + 1) / pages.length * 100);
                }

                const newPdfBytes = await newPdf.save();
                const blob = new Blob([newPdfBytes], { type: 'application/pdf' });

                chrome.runtime.sendMessage({
                    action: "downloadPDF",
                    url: URL.createObjectURL(blob),
                    filename: `split_${selectedSplitFile.name}`
                }, (response) => {
                    if (response.success) {
                        statusDiv.textContent = 'PDF文件已成功分隔并开始下载';
                    } else {
                        console.error('下载失败:', response.error);
                        statusDiv.textContent = '下载失败,请重试';
                    }
                    progressContainer.style.display = 'none';
                });
            } catch (error) {
                console.error('PDF分隔失败:', error);
                statusDiv.textContent = 'PDF分隔失败,请重试';
                progressContainer.style.display = 'none';
            }
        });

        function updateFileList() {
            selectedFiles = Array.from(pdfInput.files);
            renderFileList();
        }

        function renderFileList() {
            fileList.innerHTML = '';
            selectedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'fileItem';
                fileItem.innerHTML = `
                    <span>${file.name}</span>
                    <div>
                        <button class="moveUp" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button class="moveDown" ${index === selectedFiles.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="remove">×</button>
                    </div>
                `;
                fileList.appendChild(fileItem);

                fileItem.querySelector('.moveUp').addEventListener('click', () => moveFile(index, -1));
                fileItem.querySelector('.moveDown').addEventListener('click', () => moveFile(index, 1));
                fileItem.querySelector('.remove').addEventListener('click', () => removeFile(index));
            });
        }

        function moveFile(index, direction) {
            const newIndex = index + direction;
            if (newIndex >= 0 && newIndex < selectedFiles.length) {
                [selectedFiles[index], selectedFiles[newIndex]] = [selectedFiles[newIndex], selectedFiles[index]];
                renderFileList();
            }
        }

        function removeFile(index) {
            selectedFiles.splice(index, 1);
            renderFileList();
        }

        async function mergePDFs() {
            if (selectedFiles.length === 0) {
                statusDiv.textContent = '请选择PDF文件';
                return;
            }

            statusDiv.textContent = '正在准备合并PDF文件...';
            progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                const mergedPdf = await mergePDFFiles(selectedFiles, updateProgress);
                const blob = new Blob([mergedPdf], { type: 'application/pdf' });
                
                const fileName = outputFileName.value.trim() || 'merged.pdf';
                
                chrome.runtime.sendMessage({
                    action: "downloadPDF",
                    url: URL.createObjectURL(blob),
                    filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
                }, (response) => {
                    if (response.success) {
                        statusDiv.textContent = 'PDF文件已成功合并并开始下载';
                    } else {
                        console.error('下载失败:', response.error);
                        statusDiv.textContent = '下载失败,请重试';
                    }
                    progressContainer.style.display = 'none';
                });
            } catch (error) {
                console.error('PDF合并失败:', error);
                statusDiv.textContent = 'PDF合并失败,请重试';
                progressContainer.style.display = 'none';
            }
        }

        function parsePageRange(range, totalPages) {
            const pages = new Set();
            const parts = range.split(',');

            for (const part of parts) {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(num => parseInt(num.trim()));
                    for (let i = start; i <= end && i <= totalPages; i++) {
                        pages.add(i);
                    }
                } else {
                    const pageNum = parseInt(part.trim());
                    if (pageNum <= totalPages) {
                        pages.add(pageNum);
                    }
                }
            }

            return Array.from(pages).sort((a, b) => a - b);
        }
    });

    function updateProgress(percent) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }
}

async function mergePDFFiles(pdfFiles, updateProgress) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const totalFiles = pdfFiles.length;

    for (let i = 0; i < totalFiles; i++) {
        const pdfFile = pdfFiles[i];
        const pdfBytes = await readFileAsArrayBuffer(pdfFile);
        const pdf = await PDFLib.PDFDocument.load(pdfBytes);
        const copiedPages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));

        updateProgress((i + 1) / totalFiles * 100);
    }

    return pdfDoc.save();
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
