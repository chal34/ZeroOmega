import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AboutView from '../views/AboutView.vue'
import UiView from '../views/UiView.vue'
import GeneralView from '../views/GeneralView.vue'
import IoView from '../views/IoView.vue'
import BuiltinView from '../views/BuiltinView.vue'
import ThemeView from '../views/ThemeView.vue'
import ProfileView from '../views/ProfileView.vue'
import { useOmegaTarget } from '../composables/useOmegaTarget'

const routes: RouteRecordRaw[] = [
  {
    path: '/ui',
    name: 'ui',
    component: UiView,
  },
  {
    path: '/general',
    name: 'general',
    component: GeneralView,
  },
  {
    path: '/io',
    name: 'io',
    component: IoView,
  },
  {
    path: '/builtin',
    name: 'builtin',
    component: BuiltinView,
  },
  {
    path: '/theme',
    name: 'theme',
    component: ThemeView,
  },
  {
    path: '/profile/:name(.*)',
    name: 'profile',
    component: ProfileView,
    props: true,
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => {
      const omegaTarget = useOmegaTarget()
      const lastUrl = omegaTarget.lastUrl()
      return lastUrl || '/about'
    },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  const omegaTarget = useOmegaTarget()
  omegaTarget.lastUrl(to.fullPath)
})

export default router
