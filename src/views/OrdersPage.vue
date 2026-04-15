<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
// import BrandSplashLoading from '@/components/common/BrandSplashLoading.vue'
import { useSplashLoading } from '@/stores/splashLoading'

const router = useRouter()

const session = ref(null)
const authUserLabel = ref('')
const orderHistoryList = ref([])
const isLoadingOrderHistory = ref(false)
const isLoadingMoreOrders = ref(false)
const hasMoreOrders = ref(true)
const reorderScrollRef = ref(null)
const orderPage = ref(0)
const ORDER_PAGE_SIZE = 8
// const isReorderLoading = ref(false)
const { withSplashLoading } = useSplashLoading()

// const recentOrder = computed(() => orderHistoryList.value[0] || null)
// const otherOrders = computed(() => orderHistoryList.value.slice(1))
const recentReorderOrders = computed(() => orderHistoryList.value)

const signInWithKakao = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('카카오 로그인 에러:', error.message)
  }
}

const fetchMyOrders = async ({ loadMore = false } = {}) => {
  if (!session.value?.user?.id) return

  if (loadMore) {
    if (!hasMoreOrders.value || isLoadingMoreOrders.value) return
    isLoadingMoreOrders.value = true
  } else {
    isLoadingOrderHistory.value = true
    orderPage.value = 0
    hasMoreOrders.value = true
  }
  const from = loadMore ? orderPage.value * ORDER_PAGE_SIZE : 0
  const to = from + ORDER_PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', session.value.user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('주문내역 조회 에러:', error.message)
    if (!loadMore) {
      orderHistoryList.value = []
    }
  } else {
    const fetchedOrders = data || []
    orderHistoryList.value = loadMore
      ? [...orderHistoryList.value, ...fetchedOrders]
      : fetchedOrders

    if (fetchedOrders.length < ORDER_PAGE_SIZE) {
      hasMoreOrders.value = false
    } else {
      orderPage.value += 1
    }
  }

  if (loadMore) {
    isLoadingMoreOrders.value = false
    return
  }

  isLoadingOrderHistory.value = false
}

const handleRecentReorderScroll = async () => {
  const container = reorderScrollRef.value
  if (!container || !hasMoreOrders.value || isLoadingMoreOrders.value) return

  const remainX = container.scrollWidth - (container.scrollLeft + container.clientWidth)
  if (remainX < 180) {
    await fetchMyOrders({ loadMore: true })
  }
}

// const handleReorder = (order) => {
//   router.push({
//     path: '/',
//     query: {
//       reorder: '1',
//       product_id: order.product_id,
//       product_name: order.product_name,
//       option_id: order.option_id,
//       option_name: order.option_name,
//       quantity: order.quantity,
//       total_amount: order.total_amount,
//       recipient_name: order.recipient_name || '',
//       recipient_phone: order.recipient_phone || '',
//       recipient_address: order.recipient_address || '',
//       recipient_zonecode: order.recipient_zonecode || '',
//       recipient_base_address: order.recipient_base_address || '',
//       recipient_detail_address: order.recipient_detail_address || '',
//       delivery_message: order.delivery_message || '',
//     },
//   })
// }

const handleReorder = async (order) => {
  await withSplashLoading(
    async () => {
      await router.push({
        path: '/',
        query: {
          reorder: '1',
          product_id: order.product_id,
          product_name: order.product_name,
          option_id: order.option_id,
          option_name: order.option_name,
          quantity: order.quantity,
          total_amount: order.total_amount,
          recipient_name: order.recipient_name || '',
          recipient_phone: order.recipient_phone || '',
          recipient_address: order.recipient_address || '',
          recipient_zonecode: order.recipient_zonecode || '',
          recipient_base_address: order.recipient_base_address || '',
          recipient_detail_address: order.recipient_detail_address || '',
          delivery_message: order.delivery_message || '',
        },
      })
    },
    { minDuration: 900 },
  )
}

const formatStatus = (status) => {
  if (status === 'paid') return '결제완료'
  if (status === 'pending') return '결제대기'
  if (status === 'failed') return '결제실패'
  if (status === 'cancelled') return '취소됨'
  return status || '상태없음'
}

const statusClass = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-600'
  if (status === 'pending') return 'bg-amber-50 text-amber-600'
  if (status === 'failed') return 'bg-red-50 text-red-600'
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500'
  return 'bg-gray-100 text-gray-500'
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session || null

  if (session.value?.user) {
    authUserLabel.value =
      session.value.user.email || session.value.user.user_metadata?.name || '카카오 사용자'

    await fetchMyOrders()
  }
})
</script>

<template>
  <div class="min-h-screen bg-white px-6 pt-3 pb-24">
    <div class="mx-auto max-w-[430px]">
      <template v-if="!session">
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-bold text-gray-900">비회원 상태</div>
          <div class="mt-1 text-sm text-gray-500">로그인하면 주문내역을 쉽게 볼 수 있어요</div>

          <button
            class="mt-4 w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-yellow-300"
            @click="signInWithKakao"
          >
            카카오 로그인
          </button>
        </div>
      </template>

      <template v-else>
        <div class="mb-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
          <p class="text-sm font-semibold text-black">{{ authUserLabel }}</p>
          <p class="mt-1 text-xs text-black/45">최근 주문을 확인하고 다시 주문할 수 있어요.</p>
        </div>

        <div v-if="isLoadingOrderHistory" class="py-10 text-center text-sm text-black/45">
          주문내역 불러오는 중...
        </div>

        <div v-else-if="!orderHistoryList.length" class="py-10 text-center text-sm text-black/45">
          아직 주문내역이 없습니다.
        </div>

        <div v-else>
          <!-- 최근 주문 다시하기: 가로 드래그 + 부분 로딩 -->
          <div v-if="recentReorderOrders.length">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-semibold text-black">최근 주문 다시하기</p>
              <p class="text-xs text-black/45">좌우로 드래그해서 더 보기</p>
            </div>

            <div
              ref="reorderScrollRef"
              class="flex flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto pb-2 overscroll-x-contain"
              @scroll="handleRecentReorderScroll"
            >
              <div
                v-for="order in recentReorderOrders"
                :key="`recent-${order.id}`"
                class="w-[280px] shrink-0 snap-start rounded-2xl border border-black/10 bg-black/[0.02] p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold text-black">{{ order.product_name }}</div>
                    <div class="mt-1 text-sm text-black/60">
                      {{ order.option_name }} · {{ order.quantity }}개
                    </div>
                  </div>

                  <span
                    class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    :class="statusClass(order.order_status)"
                  >
                    {{ formatStatus(order.order_status) }}
                  </span>
                </div>

                <div class="mt-3 text-sm font-semibold text-black">
                  {{ Number(order.total_amount || 0).toLocaleString() }}원
                </div>

                <button
                  class="mt-3 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                  @click="handleReorder(order)"
                >
                  다시 주문하기
                </button>
              </div>

              <div
                v-if="isLoadingMoreOrders"
                class="flex h-[174px] w-[130px] shrink-0 snap-start items-center justify-center rounded-2xl border border-black/10 bg-black/[0.02] text-xs text-black/45"
              >
                불러오는 중...
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
