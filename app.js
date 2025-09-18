// IFCO Systems - Reporte de Caixas Encontradas
// Sistema integrado para reportar containers IFCO encontrados

// Configuration
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzedlJ4NfXRKAG_4xKCU6l6Eii1zFaw7JGajKbj95v92TRdKtNxn9IiKMVkUAGGkJsA/exec';

// Application state
let formSubmissions = [];
let connectionStatus = 'connected';

// DOM elements - Form
const form = document.getElementById('data-form');
const cepInput = document.getElementById('cep');
const dateInput = document.getElementById('data');
const clearFormBtn = document.getElementById('clear-form');
const exportDataBtn = document.getElementById('export-data');

// DOM elements - Status
const statusDot = document.getElementById('status-dot');
const connectionText = document.getElementById('connection-text');

// DOM elements - Statistics
const totalBoxesEl = document.getElementById('total-boxes');
const totalSubmissionsEl = document.getElementById('total-submissions');
const cloudSubmissionsEl = document.getElementById('cloud-submissions');
const localSubmissionsEl = document.getElementById('local-submissions');

// DOM elements - Modal
const successModal = document.getElementById('success-modal');
const successMessage = document.getElementById('success-message');
const closeSuccessBtn = document.getElementById('close-success');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadStoredData();
    updateUI();
    testInitialConnection();
});

// Initialize the application
function initializeApp() {
    console.log('🚀 IFCO Systems - Reporte de Caixas inicializado com sucesso');
    setCurrentDate();
    setupCepFormatting();
    updateConnectionStatus('connected');
    setupSectionProgressTracking();
}

// Setup all event listeners
function setupEventListeners() {
    // Form events
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }
    
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportToCSV);
    }
    
    // Modal events
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', closeSuccessModal);
    }
    
    if (successModal) {
        successModal.addEventListener('click', function(e) {
            if (e.target === successModal || e.target.classList.contains('modal-backdrop')) {
                closeSuccessModal();
            }
        });
    }
    
    // Form validation and progress tracking
    const allFields = form ? form.querySelectorAll('input, select') : [];
    allFields.forEach(field => {
        // Validation on blur for required fields
        if (field.hasAttribute('required')) {
            field.addEventListener('blur', function(e) {
                validateField(e);
                updateSectionProgress();
            });
        }
        
        // Progress tracking and positive feedback on input/change
        field.addEventListener('input', function(e) {
            clearFieldError(e);
            updateSectionProgress();
            // Delay positive feedback to avoid conflicts
            setTimeout(() => showPositiveFeedback(e.target), 50);
        });
        
        field.addEventListener('change', function(e) {
            clearFieldError(e);
            updateSectionProgress();
            // Delay positive feedback to avoid conflicts
            setTimeout(() => showPositiveFeedback(e.target), 50);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isModalOpen()) {
            e.preventDefault();
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        }
        
        if (e.key === 'Escape' && isModalOpen()) {
            closeSuccessModal();
        }
    });
}

// Setup section progress tracking
function setupSectionProgressTracking() {
    // Update progress on page load
    setTimeout(updateSectionProgress, 100);
}

// Update section progress dots
function updateSectionProgress() {
    if (!form) return;

    // Define sections and their required fields
    const sections = [
        {
            element: document.querySelector('.form-group-section:nth-child(1) .section-progress'),
            fields: ['estabelecimento', 'nome_estabelecimento']
        },
        {
            element: document.querySelector('.form-group-section:nth-child(2) .section-progress'),
            fields: ['cidade', 'uf', 'rua', 'cep']
        },
        {
            element: document.querySelector('.form-group-section:nth-child(3) .section-progress'),
            fields: ['quantidade_caixas', 'data', 'nome_analista']
        },
        {
            element: document.querySelector('.form-group-section:nth-child(4) .section-progress'),
            fields: ['nome_fornecedor', 'codigo_fornecedor']
        }
    ];

    sections.forEach((section, sectionIndex) => {
        if (!section.element) return;

        const dots = section.element.querySelectorAll('.progress-dot');
        const isOptionalSection = sectionIndex === 3; // Fornecedor section
        
        let filledCount = 0;
        section.fields.forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (field && field.value.trim()) {
                filledCount++;
            }
        });

        // Update dots based on filled fields
        dots.forEach((dot, dotIndex) => {
            dot.classList.remove('active', 'completed');
            
            if (isOptionalSection) {
                // For optional section, show progress based on any filled field
                if (filledCount > 0) {
                    if (dotIndex < filledCount) {
                        dot.classList.add('completed');
                    } else if (dotIndex === filledCount) {
                        dot.classList.add('active');
                    }
                }
            } else {
                // For required sections
                const fieldsPerDot = Math.ceil(section.fields.length / dots.length);
                const requiredForThisDot = Math.min(fieldsPerDot, section.fields.length - (dotIndex * fieldsPerDot));
                const completedForThisDot = Math.min(fieldsPerDot, Math.max(0, filledCount - (dotIndex * fieldsPerDot)));
                
                if (completedForThisDot === requiredForThisDot && requiredForThisDot > 0) {
                    dot.classList.add('completed');
                } else if (completedForThisDot > 0) {
                    dot.classList.add('active');
                }
            }
        });
    });
}

// Show positive feedback for valid fields
function showPositiveFeedback(field) {
    if (!field || !field.value.trim()) return;
    
    // Remove any existing success class temporarily for visual feedback
    field.classList.remove('success');
    
    // Add success class after a brief delay for visual effect
    setTimeout(() => {
        if (field.value.trim() && !field.classList.contains('error')) {
            field.classList.add('success');
            
            // Add success message for important fields
            if (field.hasAttribute('required')) {
                showFieldSuccess(field);
            }
        }
    }, 100);
}

// Show field success message
function showFieldSuccess(field) {
    if (!field || field.classList.contains('error')) return;
    
    // Remove existing success message
    const existingSuccess = field.parentNode.querySelector('.success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    // Don't show success message if field is empty
    if (!field.value.trim()) return;
    
    // Get the correct field name from the field's name attribute or id
    const fieldName = field.getAttribute('name') || field.getAttribute('id');
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    
    const messages = {
        'estabelecimento': 'Tipo selecionado ✓',
        'nome_estabelecimento': 'Nome registrado ✓',
        'cidade': 'Cidade confirmada ✓',
        'uf': 'Estado selecionado ✓',
        'rua': 'Endereço registrado ✓',
        'cep': 'CEP válido ✓',
        'quantidade_caixas': 'Quantidade registrada ✓',
        'data': 'Data confirmada ✓',
        'nome_analista': 'Responsável identificado ✓',
        'nome_fornecedor': 'Fornecedor registrado ✓',
        'codigo_fornecedor': 'Código registrado ✓'
    };
    
    successDiv.textContent = messages[fieldName] || 'Campo preenchido ✓';
    field.parentNode.appendChild(successDiv);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

// Test initial connection
async function testInitialConnection() {
    try {
        updateConnectionStatus('testing');
        
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });
        
        updateConnectionStatus('connected');
        console.log('✅ Conexão com Google Sheets verificada');
    } catch (error) {
        console.warn('⚠️ Não foi possível testar a conexão inicial:', error.message);
        updateConnectionStatus('connected');
    }
}

// Update connection status
function updateConnectionStatus(status) {
    connectionStatus = status;
    
    if (!statusDot || !connectionText) return;
    
    statusDot.classList.remove('loading', 'error');
    
    switch (status) {
        case 'connected':
            connectionText.textContent = 'Sistema Online';
            break;
        case 'testing':
            statusDot.classList.add('loading');
            connectionText.textContent = 'Verificando...';
            break;
        case 'error':
            statusDot.classList.add('error');
            connectionText.textContent = 'Modo Offline';
            break;
        default:
            connectionText.textContent = 'Sistema Online';
    }
}

// Load stored submissions from localStorage
function loadStoredData() {
    try {
        const stored = localStorage.getItem('ifco-reporte-submissions');
        if (stored) {
            formSubmissions = JSON.parse(stored);
            console.log(`📊 ${formSubmissions.length} reportes carregados do backup local`);
        }
    } catch (e) {
        console.warn('⚠️ Erro ao carregar dados armazenados:', e);
        formSubmissions = [];
    }
}

// Save submissions to localStorage
function saveSubmissions() {
    try {
        localStorage.setItem('ifco-reporte-submissions', JSON.stringify(formSubmissions));
    } catch (e) {
        console.warn('⚠️ Erro ao salvar dados localmente:', e);
    }
}

// Set current date in the date input
function setCurrentDate() {
    if (!dateInput) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
}

// Setup CEP input formatting
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

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!form) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    
    if (!validateForm()) {
        showFormErrors();
        return;
    }
    
    setLoadingState(submitBtn, true);
    
    try {
        const formData = collectFormData();
        let googleSheetsSuccess = false;
        let errorMessage = '';
        
        try {
            await sendToGoogleSheets(formData);
            googleSheetsSuccess = true;
            console.log('✅ Reporte enviado para Google Sheets com sucesso');
        } catch (error) {
            errorMessage = error.message;
            console.error('❌ Erro ao enviar reporte para Google Sheets:', error);
        }
        
        const submission = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: formData,
            sentToSheets: googleSheetsSuccess
        };
        
        formSubmissions.push(submission);
        saveSubmissions();
        
        updateUI();
        showSuccessMessage(googleSheetsSuccess, errorMessage);
        
        updateConnectionStatus(googleSheetsSuccess ? 'connected' : 'error');
        
    } catch (error) {
        console.error('❌ Erro geral no processamento do reporte:', error);
        showErrorAlert('Erro ao processar reporte: ' + error.message);
    } finally {
        setLoadingState(submitBtn, false);
    }
}

// Send data to Google Sheets
async function sendToGoogleSheets(data) {
    try {
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(15000)
        });
        
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout - verificar conexão com a internet');
        }
        throw new Error('Erro de conexão: ' + error.message);
    }
}

// Update UI statistics
function updateUI() {
    const total = formSubmissions.length;
    const cloudSent = formSubmissions.filter(s => s.sentToSheets).length;
    const localOnly = total - cloudSent;
    const totalBoxes = formSubmissions.reduce((sum, sub) => sum + parseInt(sub.data.quantidade_caixas || 0), 0);
    
    animateNumber(totalSubmissionsEl, total);
    animateNumber(cloudSubmissionsEl, cloudSent);
    animateNumber(localSubmissionsEl, localOnly);
    animateNumber(totalBoxesEl, totalBoxes);
    
    if (exportDataBtn) {
        if (total > 0) {
            exportDataBtn.innerHTML = `<span class="btn-icon">💾</span>Exportar ${total} Reporte${total > 1 ? 's' : ''}`;
            exportDataBtn.style.opacity = '1';
        } else {
            exportDataBtn.innerHTML = '<span class="btn-icon">💾</span>Exportar Dados';
            exportDataBtn.style.opacity = '0.6';
        }
    }
}

// Animate number changes
function animateNumber(element, targetNumber) {
    if (!element) return;
    
    const currentNumber = parseInt(element.textContent) || 0;
    const difference = targetNumber - currentNumber;
    const duration = 500;
    const steps = 20;
    const stepValue = difference / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentNumber + (stepValue * currentStep));
        element.textContent = newValue;
        
        if (currentStep >= steps) {
            clearInterval(timer);
            element.textContent = targetNumber;
        }
    }, stepDuration);
}

// Show success message
function showSuccessMessage(sheetsSuccess, errorMessage) {
    if (!successModal || !successMessage) return;
    
    let message;
    if (sheetsSuccess) {
        message = 'O reporte foi enviado com sucesso para o sistema IFCO e salvo localmente como backup.';
    } else {
        message = 'O reporte foi salvo localmente como backup. O envio para o sistema será tentado novamente automaticamente.';
    }
    
    successMessage.textContent = message;
    successModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Show success celebration effect
    showSuccessAnimation();
    
    setTimeout(() => {
        if (!successModal.classList.contains('hidden')) {
            closeSuccessModal();
        }
    }, 5000);
}

// Show success animation
function showSuccessAnimation() {
    // Create floating success indicators
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            createFloatingIcon('✅', i * 200);
        }, i * 100);
    }
}

// Create floating icon animation
function createFloatingIcon(icon, delay) {
    const iconEl = document.createElement('div');
    iconEl.textContent = icon;
    iconEl.style.cssText = `
        position: fixed;
        font-size: 24px;
        pointer-events: none;
        z-index: 9999;
        opacity: 0;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        transition: all 2s ease-out;
    `;
    
    document.body.appendChild(iconEl);
    
    setTimeout(() => {
        iconEl.style.opacity = '1';
        iconEl.style.transform = `translate(-50%, -150px) scale(1.5)`;
    }, 10);
    
    setTimeout(() => {
        iconEl.style.opacity = '0';
        iconEl.style.transform = `translate(-50%, -200px) scale(0.5)`;
    }, 1000);
    
    setTimeout(() => {
        if (iconEl.parentNode) {
            iconEl.remove();
        }
    }, 2000);
}

// Close success modal
function closeSuccessModal() {
    if (successModal) {
        successModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    clearForm();
}

// Check if any modal is open
function isModalOpen() {
    return successModal && !successModal.classList.contains('hidden');
}

// Set loading state for button
function setLoadingState(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.classList.add('btn--loading');
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="btn-icon">🔄</span>Enviando Reporte...';
    } else {
        button.classList.remove('btn--loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

// Form validation functions
function validateForm() {
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!validateField({ target: field })) {
            isValid = false;
        }
    });
    
    return isValid;
}

function showFormErrors() {
    const firstError = form.querySelector('.form-control.error');
    if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError.focus();
        showErrorAlert('Por favor, corrija os campos destacados em vermelho.');
    }
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    clearFieldError({ target: field });
    
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'Este campo é obrigatório');
        return false;
    }
    
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
    
    if (value) {
        field.classList.add('success');
        field.classList.remove('error');
    }
    
    return true;
}

function showFieldError(field, message) {
    if (!field) return;
    
    field.classList.add('error');
    field.classList.remove('success');
    
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(e) {
    const field = e.target;
    if (!field) return;
    
    field.classList.remove('error');
    
    const errorMessage = field.parentNode.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

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
    
    return data;
}

// Clear form
function clearForm() {
    if (!form) return;
    
    form.reset();
    
    const fields = form.querySelectorAll('.form-control');
    fields.forEach(field => {
        field.classList.remove('error', 'success');
    });
    
    const errorMessages = form.querySelectorAll('.error-message, .success-message');
    errorMessages.forEach(msg => msg.remove());
    
    // Reset section progress
    const progressDots = form.querySelectorAll('.progress-dot');
    progressDots.forEach(dot => {
        dot.classList.remove('active', 'completed');
    });
    
    setCurrentDate();
    
    const firstField = form.querySelector('#estabelecimento');
    if (firstField) {
        setTimeout(() => firstField.focus(), 100);
    }
}

// Export to CSV
function exportToCSV() {
    if (formSubmissions.length === 0) {
        showErrorAlert('Nenhum reporte para exportar. Envie pelo menos um reporte primeiro.');
        return;
    }
    
    const headers = [
        'Estabelecimento', 'Nome_Estabelecimento', 'Cidade', 'Rua', 'CEP', 'UF',
        'Quantidade_Caixas', 'Data_Reporte', 'Responsavel', 'Nome_Fornecedor', 
        'Codigo_Fornecedor', 'Timestamp', 'Enviado_Sistema'
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
        
        const escapedRow = row.map(field => {
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        });
        
        csv += escapedRow.join(',') + '\n';
    });
    
    try {
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const filename = `ifco-reportes-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccessAlert(`Backup exportado com sucesso! ${formSubmissions.length} reportes salvos em ${filename}`);
        
    } catch (error) {
        console.error('❌ Erro na exportação:', error);
        showErrorAlert('Erro ao exportar reportes. Tente novamente.');
    }
}

// Show alert functions
function showErrorAlert(message) {
    showCustomAlert(message, 'error');
}

function showSuccessAlert(message) {
    showCustomAlert(message, 'success');
}

function showCustomAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert ${type}`;
    
    const icon = type === 'error' ? '⚠️' : '✅';
    const color = type === 'error' ? 'var(--color-error)' : 'var(--color-success)';
    
    alertDiv.innerHTML = `
        <div class="alert-content">
            <span class="alert-icon">${icon}</span>
            <span class="alert-message" style="color: ${color};">${message}</span>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('custom-alert-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-alert-styles';
        style.textContent = `
            .custom-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--color-surface);
                border: 2px solid var(--color-border);
                border-radius: var(--radius-base);
                padding: var(--space-16);
                box-shadow: var(--shadow-lg);
                z-index: 9999;
                animation: slideInRight 0.3s ease-out;
                max-width: 400px;
                cursor: pointer;
            }
            .custom-alert.error {
                border-color: var(--color-error);
            }
            .custom-alert.success {
                border-color: var(--color-success);
            }
            .alert-content {
                display: flex;
                align-items: center;
                gap: var(--space-8);
            }
            .alert-icon {
                font-size: var(--font-size-lg);
            }
            .alert-message {
                font-weight: var(--font-weight-medium);
                font-size: var(--font-size-sm);
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @media (max-width: 768px) {
                .custom-alert {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, type === 'error' ? 7000 : 4000);
    
    alertDiv.addEventListener('click', () => alertDiv.remove());
}

console.log('🎯 IFCO Systems - Reporte de Caixas Encontradas carregado com sucesso!');
console.log('📦 Sistema integrado para reportar containers IFCO encontrados em estabelecimentos não credenciados.');