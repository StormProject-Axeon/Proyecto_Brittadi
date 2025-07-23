document.addEventListener('DOMContentLoaded', function() {
  const loginBox = document.querySelector('.login-box');

  // Verificar si hay datos guardados en LocalStorage
  const savedEmail = localStorage.getItem('savedEmail');
  if (savedEmail) {
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput) emailInput.value = savedEmail;
  }

  // Verificar si ya está logueado o si no hay usuarios
  checkAuthStatus();

  // Manejar envío de formulario
  if (loginBox) {
    const loginForm = loginBox.querySelector('form') || loginBox;

    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearError();

      const email = this.querySelector('input[type="email"]').value;
      const password = this.querySelector('input[type="password"]').value;

      // Validación básica
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showError('Por favor ingrese un correo electrónico válido');
        return;
      }
      if (!password || password.length < 8) {
        showError('La contraseña debe tener al menos 8 caracteres');
        return;
      }

      showLoading(true);

      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include'
        });

        const result = await response.json();

        if (response.ok && result.success) {
          localStorage.setItem('savedEmail', email);
          localStorage.setItem('currentUser', JSON.stringify({
            userId: result.user.id,
            email: email,
            lastCheck: new Date().toISOString()
          }));

          showToast('Inicio de sesión exitoso');
          window.location.href = result.redirect;
        } else {
          showError(result.message || 'Error al iniciar sesión');
        }
      } catch (error) {
        console.error('Error:', error);
        showError('Error al conectar con el servidor');
      } finally {
        showLoading(false);
      }
    });
  }

  async function checkAuthStatus() {
    // Primero verificar si hay usuarios registrados
    try {
      const usersResponse = await fetch('/check-users', { credentials: 'include' });
      const usersResult = await usersResponse.json();
      if (usersResult.success && !usersResult.hasUsers) {
        window.location.href = '/HTML/index4.html';
        return;
      }
    } catch (error) {
      console.error('Error verificando existencia de usuarios:', error);
      showError('Error al conectar con el servidor');
      return;
    }

    // Verificar autenticación local
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.lastCheck) {
      const lastCheck = new Date(currentUser.lastCheck);
      const oneHourAgo = new Date(Date.now() - 3600000);
      if (lastCheck > oneHourAgo) {
        window.location.href = '/HTML/index5.html';
        return;
      }
    }

    // Verificar con el servidor
    try {
      const response = await fetch('/check-auth', { credentials: 'include' });
      const result = await response.json();

      if (result.isAuthenticated) {
        localStorage.setItem('currentUser', JSON.stringify({
          userId: result.userId,
          email: result.email,
          lastCheck: new Date().toISOString()
        }));
        window.location.href = '/HTML/index5.html';
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
    }
  }

  function showError(message) {
    clearError();
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'error-message';
    errorDisplay.textContent = message;
    loginBox.appendChild(errorDisplay);
    setTimeout(() => errorDisplay.remove(), 5000);
  }

  function clearError() {
    const errorDisplay = loginBox.querySelector('.error-message');
    if (errorDisplay) errorDisplay.remove();
  }

  function showLoading(show) {
    const existingIndicator = document.getElementById('loading-indicator');
    if (show) {
      if (!existingIndicator) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = 'Cargando...';
        loginBox.appendChild(loadingIndicator);
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