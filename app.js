// Pre-configured Google Sheets URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzedlJ4NfXRKAG_4xKCU6l6Eii1zFaw7JGajKbj95v92TRdKtNxn9IiKMVkUAGGkJsA/exec';

// Application state
let formSubmissions = [];
let connectionStatus = 'connected';

// DOM elements
const form = document.getElementById('data-form');
const cepInput = document.getElementById('cep');
const dateInput = document.getElementById('data');
const clearFormBtn = document.getElementById('clear-form');
const exportDataBtn = document.getElementById('export-data');
const connectionStatusEl = document.getElementById('connection-status');
const recordsCountEl = document.getElementById('records-count');
const localCountEl = document.getElementById('local-count');

// Modal elements
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');
const closeSuccessBtn = document.getElementById('close-success');
const closeErrorBtn = document.getElementById('close-error');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('IFCO Form initializing...');
    initializeApp();
    setupEventListeners();
    loadStoredData();
    updateUI();
    testConnectionOnLoad();
});

// Initialize the application
function initializeApp() {
    console.log('Setting up form...');
    setCurrentDate();
    setupCepFormatting();
    setupSelectElements();
}

// Setup select elements for better compatibility
function setupSelectElements() {
    const selectElements = document.querySelectorAll('select.form-control');
    selectElements.forEach(select => {
        // Ensure the select elements are properly initialized
        select.addEventListener('change', function() {
            console.log(`Select changed: ${this.id} = ${this.value}`);
            // Trigger validation when value changes
            validateField({ target: this });
        });
        
        // Add focus/blur handlers for better UX
        select.addEventListener('focus', function() {
            this.classList.add('focused');
        });
        
        select.addEventListener('blur', function() {
            this.classList.remove('focused');
            validateField({ target: this });
        });
    });
}

// Test connection on load (silently)
async function testConnectionOnLoad() {
    console.log('Testing connection to Google Sheets...');
    try {
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain'
            }
        });
        
        if (response.ok) {
            const text = await response.text();
            if (text.includes('IFCO System')) {
                connectionStatus = 'connected';
                console.log('Connection test successful');
            } else {
                connectionStatus = 'warning';
                console.log('Connection test - unexpected response');
            }
        } else {
            connectionStatus = 'warning';
            console.log('Connection test - HTTP error:', response.status);
        }
    } catch (error) {
        connectionStatus = 'warning';
        console.warn('Connection test failed:', error);
    }
    
    updateConnectionStatus();
}

// Load stored submissions
function loadStoredData() {
    try {
        const stored = localStorage.getItem('ifco-form-submissions');
        if (stored) {
            formSubmissions = JSON.parse(stored);
            console.log(`Loaded ${formSubmissions.length} stored submissions`);
        }
    } catch (e) {
        console.warn('Failed to load stored data:', e);
        formSubmissions = [];
    }
}

// Save submissions
function saveSubmissions() {
    try {
        localStorage.setItem('ifco-form-submissions', JSON.stringify(formSubmissions));
        console.log('Submissions saved to localStorage');
    } catch (e) {
        console.warn('Failed to save submissions:', e);
    }
}

// Set current date
function setCurrentDate() {
    if (!dateInput) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
    console.log('Current date set:', dateInput.value);
}

// Setup CEP formatting
function setupCepFormatting() {
    if (!cepInput) return;
    
    cepInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length <= 8) {
            if (value.length > 5) {
                value = value.substring(0, 5) + '-' + value.substring(5);
            }
            e.target.value = value;
        }
    });

    cepInput.addEventListener('keypress', function(e) {
        if (!/[\d]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    });
}

// Setup all event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('Form submit listener added');
    }
    
    // Clear form button
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }
    
    // Export button
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportToCSV);
    }
    
    // Success modal
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', closeSuccessMessage);
    }
    
    if (successMessage) {
        successMessage.addEventListener('click', function(e) {
            if (e.target === successMessage) {
                closeSuccessMessage();
            }
        });
    }
    
    // Error modal
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', closeErrorMessage);
    }
    
    if (errorMessage) {
        errorMessage.addEventListener('click', function(e) {
            if (e.target === errorMessage) {
                closeErrorMessage();
            }
        });
    }
    
    // Real-time validation for all form fields
    const allFields = form ? form.querySelectorAll('.form-control') : [];
    allFields.forEach(field => {
        field.addEventListener('blur', validateField);
        field.addEventListener('input', clearFieldError);
        
        // Special handling for select elements
        if (field.tagName.toLowerCase() === 'select') {
            field.addEventListener('change', validateField);
        }
    });
    
    console.log(`Added validation listeners to ${allFields.length} fields`);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Form submission started...');
    
    if (!form) {
        console.error('Form not found');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) {
        console.error('Submit button not found');
        return;
    }
    
    // Validate form
    console.log('Validating form...');
    if (!validateForm()) {
        console.log('Form validation failed');
        return;
    }
    
    console.log('Form validation passed');
    
    // Show loading state
    submitBtn.classList.add('btn--loading');
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    
    try {
        const formData = collectFormData();
        console.log('Form data collected:', formData);
        
        let googleSheetsSuccess = false;
        let errorDetails = '';
        
        // Try to send to Google Sheets
        try {
            console.log('Sending to Google Sheets...');
            await sendToGoogleSheets(formData);
            googleSheetsSuccess = true;
            console.log('Successfully sent to Google Sheets');
        } catch (error) {
            errorDetails = error.message;
            console.error('Google Sheets error:', error);
        }
        
        // Always save locally as backup
        const submission = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: formData,
            sentToSheets: googleSheetsSuccess
        };
        
        formSubmissions.push(submission);
        saveSubmissions();
        console.log('Submission saved locally');
        
        // Show appropriate message
        if (googleSheetsSuccess) {
            showSuccessMessage();
        } else {
            showErrorMessage(errorDetails);
        }
        
        updateUI();
        
    } catch (error) {
        console.error('Form submission error:', error);
        showErrorMessage('Erro ao processar formulário: ' + error.message);
    } finally {
        // Reset loading state
        submitBtn.classList.remove('btn--loading');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        console.log('Form submission completed');
    }
}

// Send data to Google Sheets
async function sendToGoogleSheets(data) {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
    );
    
    const fetchPromise = fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors', // Required for Google Apps Script
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    // Race between fetch and timeout
    await Promise.race([fetchPromise, timeoutPromise]);
    
    // With no-cors mode, we can't check response status
    // Assume success if no exception was thrown
    return true;
}

// Update connection status display
function updateConnectionStatus() {
    if (!connectionStatusEl) return;
    
    if (connectionStatus === 'connected') {
        connectionStatusEl.className = 'status status--connected';
        connectionStatusEl.textContent = 'Conectado';
    } else {
        connectionStatusEl.className = 'status status--warning';
        connectionStatusEl.textContent = 'Ativo';
    }
}

// Update UI elements
function updateUI() {
    // Update records count (only successful Google Sheets submissions)
    if (recordsCountEl) {
        const sheetsCount = formSubmissions.filter(s => s.sentToSheets).length;
        recordsCountEl.textContent = sheetsCount;
    }
    
    // Update local backup count
    if (localCountEl) {
        localCountEl.textContent = `${formSubmissions.length} registros`;
    }
    
    // Update export button
    if (exportDataBtn) {
        if (formSubmissions.length > 0) {
            exportDataBtn.classList.add('has-data');
            exportDataBtn.textContent = `Exportar Backup (${formSubmissions.length} registros)`;
        } else {
            exportDataBtn.classList.remove('has-data');
            exportDataBtn.textContent = 'Exportar Backup Local (CSV)';
        }
    }
}

// Show success message
function showSuccessMessage() {
    if (!successMessage) return;
    
    const detailsEl = document.getElementById('success-details');
    if (detailsEl) {
        detailsEl.textContent = 'Os dados foram enviados com sucesso e salvos localmente como backup.';
    }
    
    successMessage.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Close success message
function closeSuccessMessage() {
    if (successMessage) {
        successMessage.classList.add('hidden');
        document.body.style.overflow = '';
    }
    clearForm();
}

// Show error message
function showErrorMessage(message) {
    if (!errorMessage) return;
    
    const detailsEl = document.getElementById('error-details');
    if (detailsEl) {
        if (message && message.trim()) {
            detailsEl.textContent = `Houve um problema ao enviar os dados, mas eles foram salvos localmente como backup. (${message})`;
        } else {
            detailsEl.textContent = 'Houve um problema ao enviar os dados, mas eles foram salvos localmente como backup.';
        }
    }
    
    errorMessage.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Close error message
function closeErrorMessage() {
    if (errorMessage) {
        errorMessage.classList.add('hidden');
        document.body.style.overflow = '';
    }
    clearForm();
}

// Validate form
function validateForm() {
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    console.log(`Validating ${requiredFields.length} required fields`);
    
    requiredFields.forEach(field => {
        const fieldValid = validateField({ target: field });
        if (!fieldValid) {
            console.log(`Field validation failed: ${field.id || field.name}`);
            isValid = false;
        }
    });
    
    console.log(`Form validation result: ${isValid}`);
    return isValid;
}

// Validate individual field
function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    // Clear previous error
    clearFieldError({ target: field });
    
    // Check if required and empty
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'Este campo é obrigatório');
        return false;
    }
    
    // Specific validations
    switch (field.id) {
        case 'cep':
            if (value && !isValidCep(value)) {
                showFieldError(field, 'CEP deve ter o formato 00000-000');
                return false;
            }
            break;
        case 'quantidade_caixas':
            if (value && (isNaN(value) || parseInt(value) < 1)) {
                showFieldError(field, 'Quantidade deve ser um número maior que 0');
                return false;
            }
            break;
        case 'nome_estabelecimento':
        case 'cidade':
        case 'rua':
        case 'nome_analista':
            if (value && value.length < 2) {
                showFieldError(field, 'Este campo deve ter pelo menos 2 caracteres');
                return false;
            }
            break;
    }
    
    // Mark as valid if field has value
    if (value) {
        field.classList.add('success');
        field.classList.remove('error');
    }
    
    return true;
}

// Show field error
function showFieldError(field, message) {
    if (!field) return;
    
    field.classList.add('error');
    field.classList.remove('success');
    
    // Remove existing error
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

// Clear field error
function clearFieldError(e) {
    const field = e.target;
    if (!field) return;
    
    field.classList.remove('error');
    
    const errorMessage = field.parentNode.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

// Validate CEP format
function isValidCep(cep) {
    const cepRegex = /^\d{5}-\d{3}$/;
    return cepRegex.test(cep);
}

// Collect form data
function collectFormData() {
    if (!form) return {};
    
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value.trim();
    }
    
    console.log('Collected form data keys:', Object.keys(data));
    return data;
}

// Clear form
function clearForm() {
    if (!form) return;
    
    console.log('Clearing form...');
    form.reset();
    
    // Clear validation states
    const fields = form.querySelectorAll('.form-control');
    fields.forEach(field => {
        field.classList.remove('error', 'success', 'focused');
    });
    
    // Remove error messages
    const errorMessages = form.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
    
    // Reset date
    setCurrentDate();
    
    // Focus first field
    const firstField = form.querySelector('#estabelecimento');
    if (firstField) {
        setTimeout(() => {
            firstField.focus();
            console.log('Focus set to first field');
        }, 100);
    }
}

// Export to CSV
function exportToCSV() {
    if (formSubmissions.length === 0) {
        alert('Nenhum dado para exportar. Envie pelo menos um formulário primeiro.');
        return;
    }
    
    console.log(`Exporting ${formSubmissions.length} records to CSV`);
    
    const headers = [
        'Estabelecimento', 'Nome_Estabelecimento', 'Cidade', 'Rua', 'CEP', 'UF',
        'Quantidade_Caixas', 'Data', 'Nome_Analista', 'Nome_Fornecedor', 
        'Codigo_Fornecedor', 'Timestamp', 'Enviado_Google_Sheets'
    ];
    
    let csv = headers.join(',') + '\n';
    
    formSubmissions.forEach(submission => {
        const data = submission.data;
        const row = [
            data.estabelecimento || '',
            data.nome_estabelecimento || '',
            data.cidade || '',
            data.rua || '',
            data.cep || '',
            data.uf || '',
            data.quantidade_caixas || '',
            data.data || '',
            data.nome_analista || '',
            data.nome_fornecedor || '',
            data.codigo_fornecedor || '',
            submission.timestamp || '',
            submission.sentToSheets ? 'Sim' : 'Não'
        ];
        
        // Escape CSV fields
        const escapedRow = row.map(field => {
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        });
        
        csv += escapedRow.join(',') + '\n';
    });
    
    // Download file
    try {
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `ifco-backup-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert(`Backup exportado com sucesso!\n${formSubmissions.length} registros salvos.`);
        console.log('CSV export completed successfully');
    } catch (error) {
        console.error('Export error:', error);
        alert('Erro ao exportar dados. Tente novamente.');
    }
}

// Debug functions for development
window.ifcoDebug = {
    getSubmissions: () => formSubmissions,
    clearSubmissions: () => {
        formSubmissions = [];
        saveSubmissions();
        updateUI();
        alert('Todos os dados locais foram limpos.');
    },
    getConfig: () => ({
        googleSheetsUrl: GOOGLE_SHEETS_URL,
        connectionStatus,
        submissionCount: formSubmissions.length
    }),
    testForm: () => {
        // Fill form with test data
        const testData = {
            estabelecimento: 'FEIRA LIVRE',
            nome_estabelecimento: 'Feira Central',
            cidade: 'São Paulo',
            rua: 'Rua das Flores, 123',
            cep: '01234-567',
            uf: 'SP',
            quantidade_caixas: '10',
            nome_analista: 'João Silva',
            nome_fornecedor: 'Fornecedor Teste',
            codigo_fornecedor: 'F001'
        };
        
        Object.keys(testData).forEach(key => {
            const field = document.getElementById(key);
            if (field) {
                field.value = testData[key];
                console.log(`Test data set: ${key} = ${testData[key]}`);
            }
        });
        
        alert('Formulário preenchido com dados de teste.');
    },
    validateAllFields: () => {
        const result = validateForm();
        console.log('Manual validation result:', result);
        return result;
    }
};

console.log('IFCO Form System loaded successfully. Use window.ifcoDebug for debugging tools.');