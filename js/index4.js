document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('registroForm');

  // Cargar datos guardados si existen
  const savedFormData = localStorage.getItem('registrationData');
  if (savedFormData) {
    const data = JSON.parse(savedFormData);
    for (const key in data) {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = data[key];
    }
  }

  // Guardar datos mientras se escriben (autoguardado)
  form.addEventListener('input', function() {
    const formData = {
      nombre: form.querySelector('input[name="nombre"]').value,
      apellidos: form.querySelector('input[name="apellidos"]').value,
      email: form.querySelector('input[type="email"]').value,
      pais: form.querySelector('input[name="pais"]').value,
      departamento: form.querySelector('input[name="departamento"]').value,
      fechaNacimiento: form.querySelector('input[type="date"]').value,
      municipio: form.querySelector('input[name="municipio"]').value,
      telefono: form.querySelector('input[type="tel"]').value,
      guardarDatos: form.querySelector('#guardar-datos').checked
    };
    localStorage.setItem('registrationData', JSON.stringify(formData));
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearError();

    const formData = {
      nombre: form.querySelector('input[name="nombre"]').value,
      apellidos: form.querySelector('input[name="apellidos"]').value,
      email: form.querySelector('input[type="email"]').value,
      password: form.querySelector('input[type="password"]').value,
      pais: form.querySelector('input[name="pais"]').value,
      departamento: form.querySelector('input[name="departamento"]').value,
      fechaNacimiento: form.querySelector('input[type="date"]').value,
      municipio: form.querySelector('input[name="municipio"]').value,
      telefono: form.querySelector('input[type="tel"]').value,
      tarjetaSeleccionada: getSelectedCard(),
      numeroTarjeta: form.querySelector('input[name="numeroTarjeta"]').value,
      guardarDatos: form.querySelector('#guardar-datos').checked
    };

    // Validación
    if (!formData.nombre || !formData.apellidos || !formData.email || !formData.password) {
      showError('Complete los campos obligatorios (Nombre, Apellidos, Correo, Contraseña)');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      showError('Correo electrónico inválido');
      return;
    }
    if (formData.password.length < 8) {
      showError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (formData.fechaNacimiento) {
      const age = calculateAge(formData.fechaNacimiento);
      if (age < 13) {
        showError('Debes tener al menos 13 años para registrarte');
        return;
      }
    }

    showLoading(true);

    try {
      const response = await fetch('/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        localStorage.setItem('savedEmail', formData.email);
        localStorage.setItem('currentUser', JSON.stringify({
          userId: result.userId || Date.now(),
          email: formData.email,
          lastCheck: new Date().toISOString()
        }));
        localStorage.removeItem('registrationData');
        showToast('Registro exitoso');
        window.location.href = result.redirect;
      } else {
        showError(result.message || 'Error al registrarse');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error al conectar con el servidor');
    } finally {
      showLoading(false);
    }
  });

  function getSelectedCard() {
    const selected = document.querySelector('.tarjetas img[style*="border"]');
    return selected ? selected.dataset.cardType : null;
  }

  document.querySelectorAll('.tarjetas img').forEach(img => {
    img.addEventListener('click', function() {
      document.querySelectorAll('.tarjetas img').forEach(i => i.style.border = 'none');
      this.style.border = '2px solid #4CAF50';
      document.getElementById('tarjetaSeleccionada').value = this.dataset.cardType;
    });
  });

  function calculateAge(birthDate) {
    if (!birthDate || isNaN(new Date(birthDate))) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    if (birth > today) return 0;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  function showError(message) {
    clearError();
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'error-message';
    errorDisplay.textContent = message;
    form.appendChild(errorDisplay);
    setTimeout(() => errorDisplay.remove(), 5000);
  }

  function clearError() {
    const errorDisplay = form.querySelector('.error-message');
    if (errorDisplay) errorDisplay.remove();
  }

  function showLoading(show) {
    const existingIndicator = document.getElementById('loading-indicator');
    if (show) {
      if (!existingIndicator) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = 'Cargando...';
        form.appendChild(loadingIndicator);
      }
    } else {
      if (existingIndicator) existingIndicator.remove();
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }
});