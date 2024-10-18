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
        const statusDiv = document.getElementById('status');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const fileList = document.getElementById('fileList');
        const outputFileName = document.getElementById('outputFileName');

        let selectedFiles = [];

        pdfInput.addEventListener('change', () => {
            selectedFiles = Array.from(pdfInput.files);
            updateFileList();
        });

        mergeButton.addEventListener('click', async () => {
            if (selectedFiles.length === 0) {
                statusDiv.textContent = '请选择PDF文件';
                return;
            }

            statusDiv.textContent = '正在准备合并PDF文件...';
            progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                const mergedPdf = await mergePDFs(selectedFiles, updateProgress);
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
        });

        function updateFileList() {
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
                const temp = selectedFiles[index];
                selectedFiles[index] = selectedFiles[newIndex];
                selectedFiles[newIndex] = temp;
                updateFileList();
            }
        }

        function removeFile(index) {
            selectedFiles.splice(index, 1);
            updateFileList();
        }

        function updateProgress(percent) {
            progressBar.value = percent;
            progressText.textContent = `${Math.round(percent)}%`;
        }
    });

    async function mergePDFs(pdfFiles, updateProgress) {
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
}
