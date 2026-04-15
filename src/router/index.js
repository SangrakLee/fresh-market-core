import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../views/LandingPage.vue'
import AuthCallbackPage from '@/views/AuthCallbackPage.vue'
import PaymentSuccessPage from '@/views/PaymentSuccessPage.vue'
import PaymentFailPage from '@/views/PaymentFailPage.vue'
import ShoppingPage from '@/views/ShoppingPage.vue'
import GroupBuyPage from '@/views/GroupBuyPage.vue'
import OrdersPage from '@/views/OrdersPage.vue'
import MyPage from '@/views/MyPage.vue'
import { useSplashLoading } from '@/stores/splashLoading'

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
      meta: {
        title: '쇼핑장보기',
        description: '쇼핑장보기 메뉴는 곧 연결될 예정입니다',
      },
    },
    {
      path: '/group-buy',
      name: 'group-buy',
      component: GroupBuyPage,
      meta: {
        title: '공동구매',
        description: '공동구매 메뉴는 곧 연결될 예정입니다',
      },
    },
    {
      path: '/orders',
      name: 'orders',
      component: OrdersPage,
      meta: {
        title: '주문내역',
        description: '최근 주문을 확인하고 빠르게 재구매 할 수 있어요',
      },
    },
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPage,
      meta: {
        title: '마이고정',
        description: '고마마정품 회원이신 고정고객님께 할인 혜택을 드려요',
      },
    },
  ],
})

const { startSplashLoading, stopSplashLoading } = useSplashLoading()

router.beforeEach((to, from, next) => {
  if (to.fullPath !== from.fullPath) {
    startSplashLoading()
  }
  next()
})

router.afterEach(() => {
  stopSplashLoading({ minDuration: 450 })
})


export default router