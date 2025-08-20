/*
import { boot } from 'quasar/wrappers'
import axios from 'axios'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({ baseURL: 'https://api.example.com' })

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
*/
import { boot } from "quasar/wrappers";
import axios from "axios";
import { LocalStorage } from "quasar";

export default boot(({ app }) => {
  // Interceptor para añadir token automáticamente
  axios.interceptors.request.use((config) => {
    const token = LocalStorage.getItem("token");
    if (token && config.url.includes("/api/")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  app.config.globalProperties.$axios = axios;
});

export { axios };
