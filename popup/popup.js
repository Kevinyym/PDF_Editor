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

        mergeButton.addEventListener('click', async () => {
            const files = pdfInput.files;
            if (files.length === 0) {
                statusDiv.textContent = '请选择PDF文件';
                return;
            }

            statusDiv.textContent = '正在准备合并PDF文件...';
            progressContainer.style.display = 'block';
            updateProgress(0);

            try {
                const mergedPdf = await mergePDFs(Array.from(files), updateProgress);
                const blob = new Blob([mergedPdf], { type: 'application/pdf' });
                
                chrome.runtime.sendMessage({
                    action: "downloadPDF",
                    url: URL.createObjectURL(blob),
                    filename: 'merged.pdf'
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
    });

    function updateProgress(percent) {
        progressBar.value = percent;
        progressText.textContent = `${Math.round(percent)}%`;
    }
}

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
