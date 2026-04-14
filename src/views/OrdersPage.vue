<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { supabase } from '@/lib/supabase'

const router = useRouter()

const session = ref(null)
const authUserLabel = ref('')
const orderHistoryList = ref([])
const isLoadingOrderHistory = ref(false)

const recentOrder = computed(() => orderHistoryList.value[0] || null)
const otherOrders = computed(() => orderHistoryList.value.slice(1))

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

const fetchMyOrders = async () => {
  if (!session.value?.user?.id) return

  isLoadingOrderHistory.value = true

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', session.value.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('주문내역 조회 에러:', error.message)
    orderHistoryList.value = []
  } else {
    orderHistoryList.value = data || []
  }

  isLoadingOrderHistory.value = false
}

const handleReorder = (order) => {
  router.push({
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
}

const formatStatus = (status) => {
  // 이번에 추가
  if (status === 'paid') return '결제완료'
  if (status === 'pending') return '결제대기'
  if (status === 'failed') return '결제실패'
  if (status === 'cancelled') return '취소됨'
  return status || '상태없음'
}

const statusClass = (status) => {
  // 이번에 추가
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

        <div v-else class="space-y-6">
          <!-- 최근 주문 -->
          <div v-if="recentOrder">
            <p class="mb-2 text-sm font-semibold text-black">최근 주문</p>

            <div class="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-semibold text-black">{{ recentOrder.product_name }}</div>
                  <div class="mt-1 text-sm text-black/60">
                    {{ recentOrder.option_name }} · {{ recentOrder.quantity }}개
                  </div>
                </div>

                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  :class="statusClass(recentOrder.order_status)"
                >
                  {{ formatStatus(recentOrder.order_status) }}
                </span>
              </div>

              <div class="mt-4 space-y-1 text-sm text-black/70">
                <p>받는 분: {{ recentOrder.recipient_name }}</p>
                <p>연락처: {{ recentOrder.recipient_phone }}</p>
                <p>주소: {{ recentOrder.recipient_address }}</p>
              </div>

              <div class="mt-4 flex items-center justify-between">
                <div class="text-base font-semibold text-black">
                  {{ Number(recentOrder.total_amount || 0).toLocaleString() }}원
                </div>

                <button
                  class="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                  @click="handleReorder(recentOrder)"
                >
                  최근 주문 다시하기
                </button>
              </div>
            </div>
          </div>

          <!-- 이번에 수정: 나머지 주문 목록 -->
          <div v-if="otherOrders.length" class="space-y-4">
            <p class="text-sm font-semibold text-black">전체 주문내역</p>

            <div
              v-for="order in otherOrders"
              :key="order.id"
              class="rounded-2xl border border-black/10 bg-white p-4"
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

              <div class="mt-4 space-y-1 text-sm text-black/70">
                <p>받는 분: {{ order.recipient_name }}</p>
                <p>연락처: {{ order.recipient_phone }}</p>
                <p>주소: {{ order.recipient_address }}</p>
              </div>

              <div class="mt-4 flex items-center justify-between">
                <div class="text-base font-semibold text-black">
                  {{ Number(order.total_amount || 0).toLocaleString() }}원
                </div>

                <button
                  class="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                  @click="handleReorder(order)"
                >
                  재주문
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
