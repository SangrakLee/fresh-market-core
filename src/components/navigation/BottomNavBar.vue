<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { House, ShoppingBag, Users, ReceiptText, CircleUserRound } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  session: {
    type: Object,
    default: null,
  },
})

const menus = [
  {
    key: 'home',
    label: '홈',
    icon: House,
    path: '/',
  },
  {
    key: 'shopping',
    label: '장보기·쇼핑',
    icon: ShoppingBag,
    path: '/shopping',
  },
  {
    key: 'group-buy',
    label: '공동구매',
    icon: Users,
    path: '/group-buy',
  },
  {
    key: 'orders',
    label: '주문내역',
    icon: ReceiptText,
    path: '/orders',
  },
  {
    key: 'mypage',
    label: '마이고정',
    icon: CircleUserRound,
    path: '/mypage',
  },
]

const currentPath = computed(() => route.path)

const isActive = (path) => currentPath.value === path

const handleMove = (menu) => {
  if (currentPath.value === menu.path) return
  router.push(menu.path)
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-white"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="mx-auto grid h-[74px] max-w-[430px] grid-cols-5">
      <button
        v-for="menu in menus"
        :key="menu.key"
        type="button"
        class="flex flex-col items-center justify-center gap-[3px]"
        @click="handleMove(menu)"
      >
        <component
          :is="menu.icon"
          class="h-6 w-6 transition-all duration-200"
          :class="isActive(menu.path) ? 'text-black' : 'text-black/40'"
          :stroke-width="isActive(menu.path) ? 2.4 : 2"
        />

        <span
          class="text-[11px] leading-none transition-all duration-200"
          :class="isActive(menu.path) ? 'font-bold text-black' : 'font-medium text-black/40'"
        >
          {{ menu.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
