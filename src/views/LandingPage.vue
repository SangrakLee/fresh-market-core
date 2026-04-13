<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0">
      <img :src="bgImg" class="w-full h-full object-cover" />
    </div>

    <div class="absolute inset-0 bg-black/40"></div>

    <div class="relative z-10 pb-24">
      <div class="relative z-10 flex min-h-screen items-top px-6 pt-20 md:px-12 md:pb-24">
        <div class="max-w-md text-white">
          <p
            class="mb-4 text-xs tracking-[0.25em] text-white/70 uppercase font-gowunbatang font-bold"
          >
            고마마정품
          </p>

          <h1 class="text-3xl font-semibold leading-relaxed md:text-5xl font-gowunbatang">
            오직 1등급<br />
            프리미엄 참외만 선별
          </h1>

          <p class="mt-5 max-w-sm text-sm leading-7 text-white/80 md:text-base font-gowunbatang">
            '고마마정품'은 직접 농사를 지어, 성주 각 공판장의<br />
            정품 시세로 정품만 선별 판매하는 1등급 참외입니다.
          </p>
        </div>
        <!-- <div class="absolute bottom-6 left-0 w-full px-6 md:px-12">
          <div
            class="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-lg shadow-lg"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-white/70">카카오친구 할인</p>
                <p class="text-sm font-semibold text-white">구매하기</p>
              </div>
              <button
                class="flex h-10 w-10 items-center justify-center rounded-full border bg-white/20 text-white active:scale-90 transition"
                @click="isBuyOpen = true"
              >
                <ChevronRight class="w-6 h-6 opacity-90 active:opacity-60 transition" />
              </button>
            </div>
          </div>
        </div> -->
        <BaseFullOverlay v-model="isBuyOpen">
          <BuyOverlayContent
            v-if="product"
            :key="buyOverlayKey"
            :product="product"
            :options="productOptions"
            @submit-order="handleSubmitOrder"
          />
        </BaseFullOverlay>

        <!-- 상태 저장 전달 -->
        <BaseFullOverlay v-model="isCheckoutOpen">
          <CheckoutOverlayContent
            v-if="checkoutOrder"
            :key="checkoutOverlayKey"
            :order="checkoutOrder"
            :is-submitting="isSubmittingOrder"
            :zonecode="selectedZonecode"
            :base-address="selectedBaseAddress"
            :profile-full-name="profileFullName"
            :profile-phone="profilePhone"
            :profile-zonecode="profileZonecode"
            :profile-base-address="profileBaseAddress"
            :profile-detail-address="profileDetailAddress"
            @open-address-search="isAddressSearchOpen = true"
            @confirm-order="handleConfirmOrder"
          />
        </BaseFullOverlay>

        <!-- 주문 완료 오버레이 -->
        <BaseFullOverlay v-model="isOrderCompleteOpen">
          <OrderCompleteContent
            v-if="completedOrder"
            :order="completedOrder"
            @close-complete="handleCloseComplete"
          />
        </BaseFullOverlay>
        <!-- 주소 검색 오버레이 -->
        <BaseFullOverlay v-model="isAddressSearchOpen">
          <AddressSearchOverlayContent @select-address="handleSelectAddress" />
        </BaseFullOverlay>
        <BaseFullOverlay v-model="isOrderHistoryOpen">
          <OrderHistoryOverlayContent
            :orders="orderHistoryList"
            :is-loading="isLoadingOrderHistory"
            @reorder="handleReorder"
          />
        </BaseFullOverlay>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import bgImg from '@/assets/images/gomamaLanding260323.jpg'
import { ChevronRight } from 'lucide-vue-next'
// import BaseBottomSheet from '@/components/overlays/BaseBottomSheet.vue'
import BaseFullOverlay from '@/components/overlays/BaseFullOverlay.vue'
import BuyOverlayContent from '@/features/buy/components/BuyOverlayContent.vue'
import CheckoutOverlayContent from '@/features/checkout/components/CheckoutOverlayContent.vue'
import OrderCompleteContent from '@/features/checkout/components/OrderCompleteContent.vue'
import AddressSearchOverlayContent from '@/features/address/components/AddressSearchOverlayContent.vue'
import OrderHistoryOverlayContent from '@/features/checkout/components/OrderHistoryOverlayContent.vue'

const route = useRoute()
const router = useRouter()

const isBuyOpen = ref(false)

const product = ref(null)
const productOptions = ref([])

const selectedZonecode = ref('')
const selectedBaseAddress = ref('')
const isCheckoutOpen = ref(false)
const checkoutOrder = ref(null)
// 주소 찾기 오버레이 열림 상태
const isAddressSearchOpen = ref(false)

// 주문 완료 오버레이 열림 상태
const isOrderCompleteOpen = ref(false)
// 완료 화면에 보여줄 주문 데이터
const completedOrder = ref(null)
// 주문 저장 중 상태
const isSubmittingOrder = ref(false)

// 자식 컴포넌트 강제 초기화용 key
const buyOverlayKey = ref(0)
const checkoutOverlayKey = ref(0)

const session = ref(null)
const profileSaved = ref(false)
const authUserLabel = ref('')
let authSubscription = null

const profileFullName = ref('')
const profilePhone = ref('')
const profileZonecode = ref('')
const profileBaseAddress = ref('')
const profileDetailAddress = ref('')

const isOrderHistoryOpen = ref(false)
const orderHistoryList = ref([])
const isLoadingOrderHistory = ref(false)

const ensureProfile = async (user) => {
  if (!user?.id) return

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email || null,
    full_name:
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.nickname ||
      '',
    provider: user.app_metadata?.provider || 'unknown',
  })

  if (error) {
    console.error('profiles upsert 에러:', error.message)
  }
  profileSaved.value = true
}

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

const signOut = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('로그아웃 에러:', error.message)
    return
  }

  session.value = null
  authUserLabel.value = ''
  profileSaved.value = false

  resetGuestCheckoutState()
}

const syncSessionAndProfile = async () => {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('세션 조회 에러:', error.message)
    return
  }

  session.value = data.session || null

  if (session.value?.user) {
    authUserLabel.value =
      session.value.user.email || session.value.user.user_metadata?.name || '카카오 사용자'

    await ensureProfile(session.value.user)
    await loadProfileDefaults(session.value.user.id)
  } else {
    authUserLabel.value = ''
    profileSaved.value = false

    profileFullName.value = ''
    profilePhone.value = ''
    profileZonecode.value = ''
    profileBaseAddress.value = ''
    profileDetailAddress.value = ''
  }
}

onMounted(async () => {
  // 기존 상품 조회
  const { data: productData } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (productData) {
    product.value = productData

    const { data: optionData } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', productData.id)
      .order('id', { ascending: true })

    productOptions.value = optionData || []
  }
  await syncSessionAndProfile()
  openReorderFromQuery()
  const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession || null

    if (!newSession?.user) {
      authUserLabel.value = ''
      profileSaved.value = false

      profileFullName.value = ''
      profilePhone.value = ''
      profileZonecode.value = ''
      profileBaseAddress.value = ''
      profileDetailAddress.value = ''

      selectedZonecode.value = ''
      selectedBaseAddress.value = ''
      return
    }

    authUserLabel.value =
      newSession.user.email || newSession.user.user_metadata?.name || '카카오 사용자'

    setTimeout(() => {
      ensureProfile(newSession.user)
    }, 0)
  })

  authSubscription = data.subscription
})

onUnmounted(() => {
  authSubscription?.unsubscribe()
})

const loadProfileDefaults = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone, default_zonecode, default_address, default_detail_address')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('profiles 기본값 조회 에러:', error.message)
    return
  }

  profileFullName.value = data.full_name || ''
  profilePhone.value = data.phone || ''
  profileZonecode.value = data.default_zonecode || ''
  profileBaseAddress.value = data.default_address || ''
  profileDetailAddress.value = data.default_detail_address || ''
}

// 주소 선택 시 체크아웃으로 반영
function handleSelectAddress(addressItem) {
  selectedZonecode.value = addressItem.zonecode
  selectedBaseAddress.value = addressItem.address
  isAddressSearchOpen.value = false
}

// BuyOverlayContent.vue 자식이 보낸 주문 데이터 받기
function handleSubmitOrder(orderPayload) {
  checkoutOrder.value = orderPayload

  if (!selectedZonecode.value && profileZonecode.value) {
    selectedZonecode.value = profileZonecode.value
  }

  if (!selectedBaseAddress.value && profileBaseAddress.value) {
    selectedBaseAddress.value = profileBaseAddress.value
  }

  isBuyOpen.value = false
  isCheckoutOpen.value = true
}

async function handleConfirmOrder(checkoutPayload) {
  // 이미 저장 중이면 중단, 중복 구매 차단
  if (isSubmittingOrder.value) return
  isSubmittingOrder.value = true

  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user || null
  const orderCode = generateOrderCode()

  const { error } = await supabase.from('orders').insert([
    {
      product_id: checkoutPayload.product_id,
      product_name: checkoutPayload.product_name,
      option_id: checkoutPayload.option_id,
      option_name: checkoutPayload.option_name,
      quantity: checkoutPayload.quantity,
      total_amount: checkoutPayload.total_amount,
      recipient_name: checkoutPayload.recipient_name,
      recipient_phone: checkoutPayload.recipient_phone,
      recipient_address: checkoutPayload.recipient_address,
      recipient_zonecode: checkoutPayload.recipient_zonecode || '',
      recipient_base_address: checkoutPayload.recipient_base_address || '',
      recipient_detail_address: checkoutPayload.recipient_detail_address || '',
      delivery_message: checkoutPayload.delivery_message,
      user_id: user?.id || null,
      order_code: orderCode,
      order_status: 'pending',
    },
  ])
  if (error) {
    alert('주문 저장 중 문제가 발생했습니다')
    isSubmittingOrder.value = false
    return
  }
  if (user?.id) {
    const { error: profileUpdateError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email || null,
      full_name:
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.nickname ||
        '',
      provider: user.app_metadata?.provider || 'unknown',
      phone: checkoutPayload.recipient_phone || '',
      default_zonecode: selectedZonecode.value || '',
      default_address: selectedBaseAddress.value || '',
      default_detail_address: '',
    })

    if (profileUpdateError) {
      console.error('profiles 기본배송지 저장 에러:', profileUpdateError.message)
    } else {
      await loadProfileDefaults(user.id)
    }
  }

  isCheckoutOpen.value = false

  // completedOrder.value = checkoutPayload
  // isOrderCompleteOpen.value = true

  checkoutOrder.value = null

  // 주소 상태 초기화
  selectedZonecode.value = ''
  selectedBaseAddress.value = ''

  // 다음 주문을 위해 자식 컴포넌트 리셋
  buyOverlayKey.value++
  checkoutOverlayKey.value++

  // 토스 결제창 호출
  await openTossPayment({
    orderCode,
    amount: checkoutPayload.total_amount,
    orderName: `${checkoutPayload.product_name} ${checkoutPayload.option_name}`,
    customerName: checkoutPayload.recipient_name,
  })

  // 저장 상태 초기화
  isSubmittingOrder.value = false
}
// 완료 오버레이 닫기 + 상태 정리
function handleCloseComplete() {
  isOrderCompleteOpen.value = false
  completedOrder.value = null

  // 주소 상태 정리
  selectedZonecode.value = ''
  selectedBaseAddress.value = ''
}

const resetGuestCheckoutState = () => {
  profileFullName.value = ''
  profilePhone.value = ''
  profileZonecode.value = ''
  profileBaseAddress.value = ''
  profileDetailAddress.value = ''

  selectedZonecode.value = ''
  selectedBaseAddress.value = ''

  checkoutOrder.value = null
  isCheckoutOpen.value = false
  isAddressSearchOpen.value = false
}
// 개인 주문 조회
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
const openOrderHistory = async () => {
  await fetchMyOrders()
  isOrderHistoryOpen.value = true
}
// const handleReorder = (oldOrder) => {
//   router.push({
//     path: '/',
//     query: {
//       reorder: '1',
//       product_id: oldOrder.product_id,
//       product_name: oldOrder.product_name,
//       option_id: oldOrder.option_id,
//       option_name: oldOrder.option_name,
//       quantity: oldOrder.quantity,
//       total_amount: oldOrder.total_amount,
//       recipient_name: oldOrder.recipient_name,
//       recipient_phone: oldOrder.recipient_phone,
//       recipient_address: oldOrder.recipient_detail_address || '',
//       recipient_detail_address: oldOrder.recipient_detail_address || '',
//       saved_full_address: oldOrder.recipient_address || '',
//       recipient_zonecode: oldOrder.recipient_zonecode || '',
//       recipient_base_address: oldOrder.recipient_base_address || '',
//       delivery_message: oldOrder.delivery_message || '',
//     },
//   })
//   selectedZonecode.value = oldOrder.recipient_zonecode || ''
//   selectedBaseAddress.value = oldOrder.recipient_base_address || ''

//   isOrderHistoryOpen.value = false
//   isCheckoutOpen.value = true
// }
// 결제 창
const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
const generateOrderCode = () => {
  return `gomama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
const openTossPayment = async ({ orderCode, amount, orderName, customerName }) => {
  try {
    const tossPayments = TossPayments(tossClientKey)
    const payment = tossPayments.payment({
      customerKey: 'guest', // 일단 임시값
    })
    await payment.requestPayment({
      method: 'CARD',
      amount: {
        currency: 'KRW',
        value: amount,
      },
      orderId: orderCode,
      orderName,
      customerName,
      successUrl: `${window.location.origin}/payment/success`,
      failUrl: `${window.location.origin}/payment/fail`,
    })
  } catch (error) {
    console.error('토스 결제창 호출 에러:', error)
    alert('결제창을 여는 중 문제가 발생했습니다.')
  }
}

const openReorderFromQuery = () => {
  if (route.query.reorder !== '1') return

  checkoutOrder.value = {
    product_id: Number(route.query.product_id || 0),
    product_name: route.query.product_name || '',
    option_id: Number(route.query.option_id || 0),
    option_name: route.query.option_name || '',
    quantity: Number(route.query.quantity || 1),
    total_amount: Number(route.query.total_amount || 0),
    recipient_name: route.query.recipient_name || '',
    recipient_phone: route.query.recipient_phone || '',
    recipient_address: route.query.recipient_detail_address || '',
    recipient_detail_address: route.query.recipient_detail_address || '',
    saved_full_address: route.query.recipient_address || '', // 지난 완성주소
    recipient_zonecode: route.query.recipient_zonecode || '',
    recipient_base_address: route.query.recipient_base_address || '',
    delivery_message: route.query.delivery_message || '',
  }

  selectedZonecode.value = route.query.recipient_zonecode || ''
  selectedBaseAddress.value = route.query.recipient_base_address || ''

  isCheckoutOpen.value = true
  // 같은 query가 남아있으면 새로고침 때 또 열릴 수 있으니 정리
  router.replace({ path: '/' })
}
</script>
