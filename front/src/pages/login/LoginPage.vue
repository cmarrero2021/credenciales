<template>
  <div class="login-container">
    <div class="background-image"></div>

    <!-- Overlay oscuro para mejorar contraste del texto -->
    <div class="overlay"></div>

    <!-- Formulario centrado -->
    <div class="login-box">
      <h4>Iniciar Sesión</h4>
      <q-input filled outlined v-model="email" label="Correo Electrónico" type="email" />
      <q-input filled outlined v-model="password" label="Contraseña" type="password" />
      <q-btn label="Ingresar" color="primary" @click="handleLogin" class="full-width" />
    </div>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { LocalStorage, Notify } from "quasar";
import axios from "axios";
const email = ref("");
const password = ref("");
const router = useRouter();
const loginUrl = import.meta.env.VITE_LOGIN_URL;
const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

const handleLogin = async () => {
  if (!email.value) {
    Notify.create({
      message: "El correo electrónico no puede estar vacío.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  } else if (!validateEmail(email.value)) {
    Notify.create({
      message: "El formato del correo electrónico no es válido.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  }

  if (!password.value) {
    Notify.create({
      message: "La contraseña no puede estar vacía.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  }
  ////////////////////////
  try {

    const response = await axios.post(loginUrl, {
      // email: email.value,
      username: email.value,
      password: password.value,
    }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
    );
    if (response.data.message === "Inicio de sesión exitoso.") {
      // Almacenar token y permisos en LocalStorage (opcional)
      LocalStorage.set('token', response.data.token);
      LocalStorage.set('permissions', response.data.permissions);

      Notify.create({
        message: "Ingresó correctamente",
        color: "positive",
        position: "top",
        timeout: 3000,
      });
      router.push("/inicio");
      // router.push("/admin");
    } else {
      Notify.create({
        message: "Credenciales inválidas",
        color: "negative",
        position: "top",
        timeout: 3000,
      });
    }
  } catch (error) {
    const mensaje = error == 'AxiosError: Request failed with status code 403'
      ? 'El usuario ya tiene una sesión abierta. Ciérrela e intente de nuevo'
      : 'Error de conexión. Intente nuevamente.';
    Notify.create({
      message: mensaje,
      color: "negative",
      position: "top",
      timeout: 3000,
    });
  }
};

const recoverPassword = () => {
  console.log("Recuperar contraseña");
};
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
}

.logo-left {
  width: 400px;
  height: 100px;
}

.logo-right {
  width: 150px;
  height: 100px;
}

.content-container {
  // display: flex;
  align-items: center;
  // justify-content: space-between;
  padding: 20px;
}

.directorio-image {
  width: 60%;
  max-width: 600px;
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 5%;
}

.full-height {
  display: flex;
  justify-content: center; /* Centra horizontal */
  align-items: center;      /* Centra vertical */
  height: 100vh;            /* Altura completa de la pantalla */
  width: 100%;              /* Ancho completo */
  padding: 20px;
  box-sizing: border-box;
}

.login-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to right, #0d47a1, #1565c0);
  overflow: hidden;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #ffffff10,
    #ffffff10 10px,
    #ffffff20 10px,
    #ffffff20 20px
  );
  z-index: 0;
  opacity: 0.2;
}
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5); /* Fondo oscuro semi-transparente */
  z-index: 1;
}

.login-box {
  animation: fadeInUp 0.6s ease-out;
  position: relative;
  z-index: 2;
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  text-align: center;
  transition: all 0.3s ease;

  h4 {
    margin-bottom: 20px;
    font-weight: bold;
    color: #1976d2;
  }

  .q-btn {
    margin-top: 15px;
  }
}

.full-width {
  width: 100%;
}

.q-tab__label {
  font-size: 10px !important;
}

@media (max-width: 768px) {
  .header {
    padding: 10px;
  }

  .logo-left {
    width: 180px;
    height: 50px;
  }

  .logo-right {
    width: 100px;
    height: 50px;
  }

  .content-container {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .directorio-image {
    width: 100%;
    max-width: 300px;
    border-radius: 5%;
    order: -1;
  }

  .login-box {
    // width: 100%;
    // max-width: 300px;
    padding: 20px;
    max-width: 90%;
    border-radius: 8px;
  }
}
</style>
