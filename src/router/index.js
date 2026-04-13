import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../views/LandingPage.vue'
import AuthCallbackPage from '@/views/AuthCallbackPage.vue'
import PaymentSuccessPage from '@/views/PaymentSuccessPage.vue'
import PaymentFailPage from '@/views/PaymentFailPage.vue'
import ShoppingPage from '@/views/ShoppingPage.vue'
import GroupBuyPage from '@/views/GroupBuyPage.vue'
import OrdersPage from '@/views/OrdersPage.vue'
import MyPage from '@/views/MyPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Landing',
      component: LandingPage,
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackPage,
    },
    {
      path: '/payment/success',
      name: 'payment-success',
      component: PaymentSuccessPage,
    },
    {
      path: '/payment/fail',
      name: 'payment-fail',
      component: PaymentFailPage,
    },
    {
      path: '/shopping',
      name: 'shopping',
      component: ShoppingPage,
    },
    {
      path: '/group-buy',
      name: 'group-buy',
      component: GroupBuyPage,
    },
    {
      path: '/orders',
      name: 'orders',
      component: OrdersPage,
    },
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPage,
    },
  ],
})

export default router