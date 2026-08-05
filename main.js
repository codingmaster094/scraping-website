document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const startScrapingBtn = document.getElementById('startScrapingBtn');
    const statusContainer = document.getElementById('statusContainer');
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
    const resultsContainer = document.getElementById('resultsContainer');
    const totalFound = document.getElementById('totalFound');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const searchInput = document.getElementById('searchInput');
    const paginationControls = document.getElementById('paginationControls');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');

    let ws;
    let allResults = [];    
    let currentPage = 1;
    const rowsPerPage = 100;

    // --- Dark Mode ---
    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark'

                
            );
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    };

    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    applyTheme(isDarkMode);

    darkModeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', isDark);
        applyTheme(isDark);
    });

    // --- WebSocket Logic ---
    function connectWebSocket(onOpenCallback) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
        }
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            if (onOpenCallback) onOpenCallback();
        };
        ws.onclose = () => console.log('WebSocket disconnected');
        ws.onerror = (error) => console.error('WebSocket error:', error);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
    }

    function handleWebSocketMessage(data) {
        switch (data.type) {
            case 'STATUS_UPDATE':
                statusMessage.textContent = data.message;
                break;
            case 'PROGRESS_UPDATE':
                progressBar.style.width = `${data.progress}%`;
                statusMessage.textContent = data.message;
                break;
            case 'TOTAL_COMPANIES':
                totalFound.textContent = `0 / ${data.total}`;
                break;
            case 'DATA_UPDATE':
                allResults.push(data.company);
                totalFound.textContent = `${allResults.length} / ${parseInt(totalFound.textContent.split('/')[1], 10)}`;
                renderTable();
                break;
            case 'SCRAPING_COMPLETE':
                statusMessage.textContent = data.message;
                startScrapingBtn.disabled = false;
                progressBar.style.width = '100%';
                progressBar.classList.remove('bg-blue-600');
                progressBar.classList.add('bg-green-600');
                setupExportLinks(data.exportFiles);
                break;
            case 'ERROR':
                statusMessage.textContent = `Error: ${data.message}`;
                statusMessage.classList.add('text-red-500');
                startScrapingBtn.disabled = false;
                break;
        }
    }

    function setupExportLinks(files) {
        exportCsvBtn.disabled = false;
        exportExcelBtn.disabled = false;
        exportJsonBtn.disabled = false;
        exportCsvBtn.onclick = () => window.location.href = `/api/download/${files.csv}`;
        exportExcelBtn.onclick = () => window.location.href = `/api/download/${files.excel}`;
        exportJsonBtn.onclick = () => window.location.href = `/api/download/${files.json}`;
    }

    // --- UI Logic ---
    startScrapingBtn.addEventListener('click', () => {
        const url = urlInput.value;
        if (!url) {
            alert('Please enter a Google Search URL.');
            return;
        }

        // Reset UI
        startScrapingBtn.disabled = true;
        statusContainer.classList.remove('hidden');
        resultsContainer.classList.remove('hidden');
        resultsTableBody.innerHTML = '';
        allResults = [];
        totalFound.textContent = '0 / 0'; // Reset total found display
        currentPage = 1;
        statusMessage.textContent = 'Connecting to server...';
        statusMessage.classList.remove('text-red-500');
        progressBar.style.width = '0%';
        progressBar.classList.remove('bg-green-600');
        progressBar.classList.add('bg-blue-600');
        exportCsvBtn.disabled = true;
        exportExcelBtn.disabled = true;
        exportJsonBtn.disabled = true;
        
        const startScraping = () => {
            ws.send(JSON.stringify({ type: 'START_SCRAPING', url }));
            statusMessage.textContent = 'Scraping started...'; // Update status after sending
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
            startScraping();
        } else {
            // If not open, connect and then send the message once connected
            connectWebSocket(startScraping);
        }
    });

    // --- Table & Pagination ---
    function renderTable() {
        const query = searchInput.value.toLowerCase();
        const filteredResults = allResults.filter(item => 
            (item.companyName || '').toLowerCase().includes(query) ||
            (item.companyUrl || '').toLowerCase().includes(query)
        );

        resultsTableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedResults = filteredResults.slice(startIndex, endIndex);

        paginatedResults.forEach(item => {
            const row = document.createElement('tr');
            const servicesHtml = Array.isArray(item.detectedServices) && item.detectedServices.length > 0
                ? item.detectedServices.map(s =>
                    `<span style="display:inline-block;margin:2px 2px;padding:2px 8px;border-radius:9999px;font-size:11px;background:rgba(14,165,233,0.15);color:#7dd3fc;border:1px solid rgba(14,165,233,0.35);">${s}</span>`
                  ).join('')
                : '<span style="color:#9ca3af">N/A</span>';

            row.innerHTML = `
                <td class="table-cell font-medium">${item.companyName || 'N/A'}</td>
                <td class="table-cell"><a href="${item.companyUrl}" target="_blank" class="text-blue-500 hover:underline truncate block max-w-xs">${item.companyUrl || 'N/A'}</a></td>
                <td class="table-cell">${item.companyEmail || 'N/A'}</td>
                <td class="table-cell">${item.companyPhone || 'N/A'}</td>
                <td class="table-cell">${servicesHtml}</td>
                <td class="table-cell">${
                    Array.isArray(item.technologies) && item.technologies.length > 0
                        ? item.technologies.slice(0, 3).map(t =>
                            `<span style="display:inline-block;margin:1px 2px;padding:2px 7px;border-radius:9999px;font-size:11px;background:#dbeafe;color:#1e40af;">${t}</span>`
                          ).join('')
                        : '<span style="color:#9ca3af">N/A</span>'
                }</td>
            `;
            resultsTableBody.appendChild(row);
        });

        renderPagination(filteredResults.length);
    }

    function renderPagination(totalItems) {
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        if (totalPages <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.className = 'pagination-btn';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.className = 'pagination-btn';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.className = 'text-sm text-gray-600 dark:text-gray-400';

        paginationControls.appendChild(prevButton);
        paginationControls.appendChild(pageInfo);
        paginationControls.appendChild(nextButton);
    }

    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTable();
    });

    // Initial connection
    connectWebSocket();
});