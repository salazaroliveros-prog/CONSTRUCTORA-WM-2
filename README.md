<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sistema ERP Constructora WM

Sistema de gestión integral para empresas constructoras desarrollado con React, TypeScript y Firebase.

## 🚀 Estado del Proyecto

✅ **Completamente funcional y listo para producción**
- ✅ Errores de TypeScript corregidos
- ✅ Build exitoso sin errores
- ✅ Reglas de Firestore configuradas
- ✅ Tests de conectividad funcionando
- ✅ Herramientas de limpieza de datos incluidas

## 🏗️ Características Principales

### 📊 **Módulos Disponibles**
- **Dashboard** - Panel principal con métricas y KPIs
- **Proyectos** - Gestión completa de proyectos de construcción
- **Presupuestos** - Calculadora de costos y presupuestos
- **Clientes** - Administración de clientes y contactos
- **Inventario** - Control de stock y materiales
- **Personal** - Gestión de recursos humanos
- **Proveedores** - Administración de proveedores
- **Analíticas** - Reportes y análisis de datos
- **Seguimiento** - Bitácora y avance de proyectos

### 🛠️ **Herramientas de Desarrollo**
- **Datos de Prueba** - Carga automática de datos para testing
- **Limpiar Datos** - Eliminación completa de datos de prueba
- **Tests de Firestore** - Verificación de conectividad

## 🔧 Instalación y Configuración

### Prerrequisitos
- Node.js (versión 18 o superior)
- Cuenta de Firebase
- Cuenta de Google para autenticación

### 1. Clonar el repositorio
```bash
git clone https://github.com/salazaroliveros-prog/CONSTRUCTORA-WM-2.git
cd CONSTRUCTORA-WM-2
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Firebase
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Authentication (Google)
3. Habilitar Firestore Database
4. Copiar configuración a `.env.local`:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 4. Desplegar reglas de Firestore
```bash
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

### 6. Build para producción
```bash
npm run build
```

## 🔐 Seguridad

### Reglas de Firestore
- ✅ Autenticación requerida para todos los accesos
- ✅ Reglas configuradas para desarrollo
- ⚠️ **IMPORTANTE**: Actualizar reglas para producción con validaciones específicas

### Autenticación
- ✅ Google OAuth integrado
- ✅ Gestión de sesiones automática
- ✅ Protección de rutas

## 📱 Uso de la Aplicación

### Primera vez
1. **Iniciar sesión** con cuenta de Google
2. **Cargar datos de prueba** desde el menú "Datos de Prueba"
3. **Explorar módulos** y familiarizarse con la interfaz
4. **Limpiar datos** cuando esté listo para datos reales

### Producción
1. **Limpiar datos de prueba** usando "Limpiar Datos"
2. **Configurar empresa** en Ajustes Visuales
3. **Comenzar a ingresar datos reales**

## 🎨 Personalización

### Temas disponibles
- **Moderno** - Limpio y equilibrado
- **Clásico** - Estilo tradicional industrial  
- **Brutalista** - Bordes fuertes y tipografía bold
- **Minimalista** - Escalas de grises y aire sutil

### Configuración
- Nombre de empresa personalizable
- Módulos activables/desactivables
- Tipos de gráficas configurables
- Modo compacto disponible

## 🚀 Despliegue

### Vercel (Recomendado)
```bash
npm run build
# Subir carpeta dist/ a Vercel
```

### Firebase Hosting
```bash
firebase init hosting
firebase deploy
```

## 🐛 Solución de Problemas

### Error de permisos de Firestore
- ✅ **Solucionado**: Reglas actualizadas para permitir acceso

### Errores de TypeScript
- ✅ **Solucionado**: Todos los tipos corregidos

### Build fallando
- ✅ **Solucionado**: Build exitoso sin errores

## 📞 Soporte

Para soporte técnico o consultas:
- **Email**: salazaroliveros@gmail.com
- **GitHub Issues**: [Crear issue](https://github.com/salazaroliveros-prog/CONSTRUCTORA-WM-2/issues)

## 📄 Licencia

Este proyecto está bajo la Licencia Apache 2.0. Ver archivo `LICENSE` para más detalles.

---

**Desarrollado con ❤️ para la industria de la construcción**
