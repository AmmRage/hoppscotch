import axios from 'axios';

const baseConfig = {
  headers: {
    'Content-type': 'application/json'
  },
  withCredentials: true,
};

console.log('admin graphql baseURL', `${import.meta.env.$VITE_ADMIN_BACKEND_GQL_URL}`);

const gqlApi = axios.create({
  ...baseConfig,
  baseURL:`${import.meta.env.$VITE_ADMIN_BACKEND_GQL_URL}`,
});

console.log('admin api baseURL', `${import.meta.env.VITE_ADMIN_BACKEND_API_URL}`);
const restApi = axios.create({
  ...baseConfig,
  baseURL: `${import.meta.env.VITE_ADMIN_BACKEND_API_URL}`,
});

const listmonkApi = axios.create({
  ...baseConfig,
  withCredentials: false,
  baseURL: 'https://listmonk.hoppscotch.com/api/public',
});

export { gqlApi, restApi, listmonkApi };
