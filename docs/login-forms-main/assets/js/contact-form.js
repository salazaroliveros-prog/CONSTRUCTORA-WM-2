// Contact Form - Modern JavaScript with Smooth Interactions

class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitBtn = this.form.querySelector('.submit-btn');
        this.successMessage = document.getElementById('successMessage');
        this.isSubmitting = false;
        
        this.validators = {
            firstName: this.validateName,
            lastName: this.validateName,
            email: this.validateEmail,
            phone: this.validatePhone,
            subject: this.validateSelect,
            message: this.validateMessage,
            consent: this.validateConsent
        };
        
        this.init();
    }
    
    init() {
        this.addEventListeners();
        this.setupFloatingLabels();
        this.addInputAnimations();
    }
    
    addEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Real-time validation
        Object.keys(this.validators).forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldName));
                field.addEventListener('input', () => this.clearError(fieldName));
            }
        });
        
        // Enhanced focus effects
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', (e) => this.handleFocus(e));
            input.addEventListener('blur', (e) => this.handleBlur(e));
        });
        
        // Checkbox animation
        const checkbox = document.getElementById('consent');
        if (checkbox) {
            checkbox.addEventListener('change', () => this.animateCheckbox());
        }
    }
    
    setupFloatingLabels() {
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // Check if field has value on page load
            if (input.value.trim() !== '' || input.type === 'email') {
                input.classList.add('has-value');
            }
            
            input.addEventListener('input', () => {
                if (input.value.trim() !== '') {
                    input.classList.add('has-value');
                } else {
                    input.classList.remove('has-value');
                }
            });
        });
    }
    
    addInputAnimations() {
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach((input, index) => {
            // Stagger animation on page load
            setTimeout(() => {
                input.style.opacity = '1';
                input.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
    
    handleFocus(e) {
        const wrapper = e.target.closest('.input-wrapper, .select-wrapper, .textarea-wrapper');
        if (wrapper) {
            wrapper.classList.add('focused');
        }
    }
    
    handleBlur(e) {
        const wrapper = e.target.closest('.input-wrapper, .select-wrapper, .textarea-wrapper');
        if (wrapper) {
            wrapper.classList.remove('focused');
        }
    }
    
    animateCheckbox() {
        const checkmark = document.querySelector('.checkmark');
        if (checkmark) {
            checkmark.style.transform = 'scale(0.8)';
            setTimeout(() => {
                checkmark.style.transform = 'scale(1)';
            }, 150);
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        
        const isValid = this.validateForm();
        
        if (isValid) {
            await this.submitForm();
        } else {
            this.shakeForm();
        }
    }
    
    validateForm() {
        let isValid = true;
        
        Object.keys(this.validators).forEach(fieldName => {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    validateField(fieldName) {
        const field = document.getElementById(fieldName);
        const validator = this.validators[fieldName];
        
        if (!field || !validator) return true;
        
        const result = validator.call(this, field.value.trim(), field);
        
        if (result.isValid) {
            this.clearError(fieldName);
            this.showSuccess(fieldName);
        } else {
            this.showError(fieldName, result.message);
        }
        
        return result.isValid;
    }
    
    validateName(value) {
        if (!value) {
            return { isValid: false, message: 'This field is required' };
        }
        if (value.length < 2) {
            return { isValid: false, message: 'Must be at least 2 characters long' };
        }
        if (!/^[a-zA-Z\s'-]+$/.test(value)) {
            return { isValid: false, message: 'Only letters, spaces, hyphens and apostrophes allowed' };
        }
        return { isValid: true };
    }
    
    validateEmail(value) {
        if (!value) {
            return { isValid: false, message: 'Email address is required' };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { isValid: false, message: 'Please enter a valid email address' };
        }
        return { isValid: true };
    }
    
    validatePhone(value) {
        // Phone is optional, but if provided, should be valid
        if (!value) return { isValid: true };
        
        const phoneRegex = /^[\+]?[\s\-\(\)]?([0-9][\s\-\(\)]?){10,14}$/;
        if (!phoneRegex.test(value.replace(/\s/g, ''))) {
            return { isValid: false, message: 'Please enter a valid phone number' };
        }
        return { isValid: true };
    }
    
    validateSelect(value) {
        if (!value) {
            return { isValid: false, message: 'Please select a subject' };
        }
        return { isValid: true };
    }
    
    validateMessage(value) {
        if (!value) {
            return { isValid: false, message: 'Message is required' };
        }
        if (value.length < 10) {
            return { isValid: false, message: 'Message must be at least 10 characters long' };
        }
        if (value.length > 1000) {
            return { isValid: false, message: 'Message must be less than 1000 characters' };
        }
        return { isValid: true };
    }
    
    validateConsent(value, field) {
        if (!field.checked) {
            return { isValid: false, message: 'You must agree to the terms to continue' };
        }
        return { isValid: true };
    }
    
    showError(fieldName, message) {
        const formGroup = document.getElementById(fieldName).closest('.form-group');
        const errorElement = document.getElementById(fieldName + 'Error');
        
        formGroup.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // Add shake animation to the field
        const field = document.getElementById(fieldName);
        field.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            field.style.animation = '';
        }, 500);
    }
    
    clearError(fieldName) {
        const formGroup = document.getElementById(fieldName).closest('.form-group');
        const errorElement = document.getElementById(fieldName + 'Error');
        
        formGroup.classList.remove('error');
        errorElement.classList.remove('show');
        setTimeout(() => {
            errorElement.textContent = '';
        }, 300);
    }
    
    showSuccess(fieldName) {
        const field = document.getElementById(fieldName);
        const wrapper = field.closest('.input-wrapper, .select-wrapper, .textarea-wrapper');
        
        // Add subtle success indication
        wrapper.style.borderColor = '#22c55e';
        setTimeout(() => {
            wrapper.style.borderColor = '';
        }, 2000);
    }
    
    shakeForm() {
        this.form.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            this.form.style.animation = '';
        }, 500);
    }
    
    async submitForm() {
        this.isSubmitting = true;
        this.submitBtn.classList.add('loading');
        
        try {
            // Simulate API call
            await this.simulateSubmission();
            
            // Show success state
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showSubmissionError();
        } finally {
            this.isSubmitting = false;
            this.submitBtn.classList.remove('loading');
        }
    }
    
    simulateSubmission() {
        return new Promise((resolve) => {
            // Simulate network delay
            setTimeout(() => {
                resolve();
            }, 2000);
        });
    }
    
    showSuccessMessage() {
        // Hide form with smooth animation
        this.form.style.opacity = '0';
        this.form.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            this.form.style.display = 'none';
            this.successMessage.classList.add('show');
            
            // Auto-hide success message and reset form after 5 seconds
            setTimeout(() => {
                this.resetForm();
            }, 5000);
        }, 300);
    }
    
    showSubmissionError() {
        // Create and show error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'submission-error';
        errorDiv.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-top: 16px; color: #ef4444; text-align: center;">
                <strong>Submission Failed</strong><br>
                Please check your connection and try again.
            </div>
        `;
        
        this.form.appendChild(errorDiv);
        
        // Remove error after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    resetForm() {
        this.successMessage.classList.remove('show');
        
        setTimeout(() => {
            this.form.style.display = 'block';
            this.form.reset();
            
            // Clear all validation states
            Object.keys(this.validators).forEach(fieldName => {
                this.clearError(fieldName);
            });
            
            // Reset form appearance
            this.form.style.opacity = '1';
            this.form.style.transform = 'translateY(0)';
            
            // Reset floating labels
            const inputs = this.form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.classList.remove('has-value');
            });
        }, 300);
    }
    
    // Public method to manually validate form
    validate() {
        return this.validateForm();
    }
    
    // Public method to get form data
    getFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }
}

// Initialize form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add entrance animation to form card
    const formCard = document.querySelector('.form-card');
    if (formCard) {
        formCard.style.opacity = '0';
        formCard.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            formCard.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            formCard.style.opacity = '1';
            formCard.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // Initialize the contact form
    new ContactForm();
});

// Handle page visibility changes for better UX
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Re-focus on form if user returns to page
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            const firstInput = document.querySelector('#firstName');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }
});