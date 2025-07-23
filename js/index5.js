document.addEventListener('DOMContentLoaded', async function() {
  try {
    showLoading(true);

    const authStatus = await verifyAuth();
    if (!authStatus.authenticated) {
      const usersResponse = await fetch('/check-users', { credentials: 'include' });
      const usersResult = await usersResponse.json();
      if (usersResult.success && !usersResult.hasUsers) {
        window.location.href = '/HTML/index4.html';
        return;
      }
      redirectToLogin();
      return;
    }

    const profileData = await loadProfileData();
    displayProfile(profileData);
    setupEventListeners();

    updateLocalAuthState(authStatus);
  } catch (error) {
    handleProfileError(error);
  } finally {
    showLoading(false);
  }
});

async function verifyAuth() {
  try {
    const response = await fetch('/check-auth', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Error de red al verificar autenticación');
    }

    const data = await response.json();
    if (!data.isAuthenticated) {
      throw new Error('Usuario no autenticado');
    }

    if (data.email) {
      localStorage.setItem('savedEmail', data.email);
    }

    return {
      authenticated: true,
      user: {
        id: data.userId,
        email: data.email
      }
    };
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    throw error;
  }
}

async function loadProfileData() {
  try {
    const cachedProfile = getCachedProfile();
    if (cachedProfile) {
      return cachedProfile;
    }

    const response = await fetch('/perfil', {
      credentials: 'include'
    });

    if (response.status === 401) {
      throw new Error('No autorizado');
    }

    if (!response.ok) {
      throw new Error('Error al cargar perfil');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Error en los datos del perfil');
    }

    cacheProfileData(result.data);
    return result.data;
  } catch (error) {
    console.error('Error cargando perfil:', error);
    throw error;
  }
}

function displayProfile(data) {
  if (!data) return;

  setElementText('.profile-username', data.username || '@player503071702');
  setElementText('#friends-count', '1032'); // This could be dynamic if stored
  setElementText('#following-count', '1670'); // This could be dynamic if stored

  const descripcion = document.getElementById('profile-description-text');
  if (descripcion) {
    descripcion.innerHTML = `
      ${data.descripcion || 'Me gusta jugar videojuegos en mi tiempo libre.'}<br>
      <strong>Nombre:</strong> ${data.nombre || 'Player'}<br>
      <strong>Edad:</strong> ${calculateAge(data.fecha_nacimiento) || '19 años'}<br>
      <strong>Juego favorito:</strong> ${data.juego_favorito || 'Fatal Fury'}<br>
      <strong>Mejor Amigo:</strong> ${data.mejor_amigo || 'Gabriela'}<br>
      <span class="hashtags">${data.hashtags || '#Xbox #Segaa #Fortnite #Nintendo #Playstation'}</span>
    `;
  }

  if (data.avatar_url) {
    const avatarImg = document.querySelector('.profile-avatar img');
    if (avatarImg) {
      avatarImg.src = data.avatar_url;
      avatarImg.alt = `Avatar de ${data.username || data.nombre || 'Usuario'}`;
    }
  }
}

function setupEventListeners() {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const editBtn = document.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', showEditProfileModal);
  }

  const avatarUpload = document.getElementById('avatar-upload');
  if (avatarUpload) {
    avatarUpload.addEventListener('change', handleAvatarUpload);
  }
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    showLoading(true);
    const response = await fetch('/perfil/avatar', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const result = await response.json();
    if (response.ok && result.success) {
      showToast('Foto de perfil actualizada');
      const profileData = await loadProfileData();
      displayProfile(profileData);
    } else {
      showError(result.message || 'Error al actualizar la foto');
    }
  } catch (error) {
    console.error('Error subiendo avatar:', error);
    showError('Error al conectar con el servidor');
  } finally {
    showLoading(false);
    event.target.value = ''; // Reset file input
  }
}

async function handleLogout() {
  try {
    showLoading(true);
    const response = await fetch('/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Error al cerrar sesión');
    }

    clearLocalAuthData();
    showToast('Sesión cerrada correctamente');
    redirectToLogin();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    showError('Error al cerrar sesión. Intenta nuevamente.');
  } finally {
    showLoading(false);
  }
}

function showEditProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'editProfileModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" style="float: right; cursor: pointer;">×</span>
      <h2>Editar Perfil</h2>
      <form id="editProfileForm">
        <input type="text" name="username" placeholder="Nombre de usuario" value="@player503071702">
        <textarea name="descripcion" placeholder="Descripción">Me gusta jugar videojuegos en mi tiempo libre.</textarea>
        <input type="text" name="juego_favorito" placeholder="Juego favorito" value="Fatal Fury">
        <input type="text" name="mejor_amigo" placeholder="Mejor amigo" value="Gabriela">
        <input type="text" name="hashtags" placeholder="Hashtags" value="#Xbox #Segaa #Fortnite #Nintendo #Playstation">
        <button type="submit">Guardar</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.close').onclick = () => modal.remove();
  modal.querySelector('#editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      username: modal.querySelector('[name="username"]').value,
      descripcion: modal.querySelector('[name="descripcion"]').value,
      juego_favorito: modal.querySelector('[name="juego_favorito"]').value,
      mejor_amigo: modal.querySelector('[name="mejor_amigo"]').value,
      hashtags: modal.querySelector('[name="hashtags"]').value
    };

    try {
      showLoading(true);
      const response = await fetch('/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showToast('Perfil actualizado correctamente');
        modal.remove();
        const profileData = await loadProfileData();
        displayProfile(profileData);
      } else {
        showError(result.message || 'Error al actualizar perfil');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      showError('Error al conectar con el servidor');
    } finally {
      showLoading(false);
    }
  });
}

function calculateAge(birthDate) {
  if (!birthDate || isNaN(new Date(birthDate))) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (birth > today) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age + ' años';
}

function formatDate(dateString) {
  if (!dateString) return null;
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
}

function setElementText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function showLoading(show) {
  const loadingIndicator = document.getElementById('loading-indicator');
  const profileContainer = document.querySelector('.profile-container');

  if (loadingIndicator) loadingIndicator.style.display = show ? 'block' : 'none';
  if (profileContainer) profileContainer.style.display = show ? 'none' : 'block';
}

function showError(message) {
  const errorDisplay = document.getElementById('error-display');
  if (errorDisplay) {
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    setTimeout(() => errorDisplay.style.display = 'none', 5000);
  }
}

function clearError() {
  const errorDisplay = document.getElementById('error-display');
  if (errorDisplay) errorDisplay.style.display = 'none';
}

function redirectToLogin() {
  window.location.href = '/HTML/index3.html';
}

function getCachedProfile() {
  const cachedData = localStorage.getItem('userProfile');
  if (!cachedData) return null;
  try {
    return JSON.parse(cachedData);
  } catch {
    return null;
  }
}

function cacheProfileData(data) {
  localStorage.setItem('userProfile', JSON.stringify(data));
}

function clearLocalAuthData() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userProfile');
  localStorage.removeItem('savedEmail');
}

function updateLocalAuthState(authStatus) {
  localStorage.setItem('currentUser', JSON.stringify({
    userId: authStatus.user.id,
    email: authStatus.user.email,
    lastCheck: new Date().toISOString()
  }));
}

async function handleProfileError(error) {
  console.error('Error en perfil:', error);
  const cachedProfile = getCachedProfile();
  if (cachedProfile) {
    displayProfile(cachedProfile);
    showError('Mostrando datos guardados. No se pudo conectar al servidor.');
    return;
  }

  try {
    const usersResponse = await fetch('/check-users', { credentials: 'include' });
    const usersResult = await usersResponse.json();
    if (usersResult.success && !usersResult.hasUsers) {
      window.location.href = '/HTML/index4.html';
      return;
    }
  } catch (err) {
    console.error('Error verificando existencia de usuarios:', err);
  }

  if (error.message.includes('No autorizado')) {
    clearLocalAuthData();
    redirectToLogin();
  } else {
    showError('Error al cargar el perfil. Intenta recargar la página.');
  }
}

function showToast(message) {
  const existingToast = document.querySelector('.toast-message');
  if (existingToast) existingToast.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}