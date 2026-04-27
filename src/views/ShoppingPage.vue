<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import BaseFullOverlay from '@/components/overlays/BaseFullOverlay.vue'
import CheckoutOverlayContent from '@/features/checkout/components/CheckoutOverlayContent.vue'
import AddressSearchOverlayContent from '@/features/address/components/AddressSearchOverlayContent.vue'
const detailImageModules = import.meta.glob('../assets/images/detail-img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const detailImagePaths = Object.values(detailImageModules).sort()
const heroScrollRef = ref(null)

const activeImageIndex = computed(() => {
  const index = products.value.findIndex((product) => product.key === activeTab.value)
  return index >= 0 ? index : 0
})

const setActiveProduct = async (key, smooth = true) => {
  activeTab.value = key

  await nextTick()

  const container = heroScrollRef.value
  if (!container) return

  const index = products.value.findIndex((product) => product.key === key)
  if (index < 0) return

  container.scrollTo({
    left: container.clientWidth * index,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

const handleHeroScroll = () => {
  const container = heroScrollRef.value
  if (!container || !products.value.length) return

  const index = Math.round(container.scrollLeft / container.clientWidth)
  const targetProduct = products.value[index]

  if (targetProduct) {
    activeTab.value = targetProduct.key
  }
}

const products = ref([])
const isLoading = ref(false)
const loadError = ref('')
const activeTab = ref(null)
const selectedWeights = ref([])
const quantities = ref({})
const memberType = ref('비회원')
const customerName = ref('고객')
const productName = ref('참외')
const isMember = computed(() => memberType.value !== '비회원')
const isCheckoutOpen = ref(false)
const checkoutOrder = ref(null)
const selectedZonecode = ref('')
const selectedBaseAddress = ref('')
const isAddressSearchOpen = ref(false)
const isSubmittingOrder = ref(false)

const memberStatusMessage = computed(() => {
  if (!isMember.value) {
    return '비회원입니다.'
  }

  return `${memberType.value} ${customerName.value}님 회원가 적용됩니다.`
})
const activeProduct = computed(
  () =>
    products.value.find((product) => product.key === activeTab.value) ?? products.value[0] ?? null,
)

const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price)

const totalPrice = computed(() =>
  selectedWeights.value.reduce((total, key) => {
    const product = products.value.find((item) => item.key === key)

    if (!product) {
      return total
    }

    const unitPrice = isMember.value ? product.memberPrice : product.guestPrice
    return total + unitPrice * (quantities.value[key] ?? 1)
  }, 0),
)

const selectedProducts = computed(() =>
  products.value.filter((product) => selectedWeights.value.includes(product.key)),
)

const totalSelectedQuantity = computed(() =>
  selectedProducts.value.reduce((sum, product) => sum + (quantities.value[product.key] ?? 1), 0),
)

const bottomActionLabel = computed(() => {
  if (!selectedProducts.value.length) {
    return '옵션을 선택해 주세요'
  }

  return `${selectedProducts.value.length}개 옵션 · ${totalSelectedQuantity.value}박스`
})

const getKakaoTargetId = async (providerToken) => {
  if (!providerToken) return null

  const meResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${providerToken}`,
    },
  })

  if (!meResponse.ok) {
    const errorBody = await meResponse.text()
    throw new Error(`카카오 사용자 조회 실패: ${meResponse.status} ${errorBody}`)
  }

  const me = await meResponse.json()
  return me?.id ? String(me.id) : null
}

const loadMemberInfo = async () => {
  try {
    const { data } = await supabase.auth.getSession()
    const currentSession = data.session || null

    if (!currentSession?.user) {
      memberType.value = '비회원'
      customerName.value = '고객'
      return
    }

    memberType.value = '회원'
    customerName.value =
      currentSession.user.user_metadata?.name || currentSession.user.email || '고객'

    const targetId = await getKakaoTargetId(currentSession.provider_token)

    if (!targetId) return

    const { data: relationData, error: relationError } = await supabase.functions.invoke(
      'check-kakao-channel-relation',
      {
        body: { targetId },
      },
    )

    if (relationError) {
      throw new Error(relationError.message || '카카오 채널 관계 조회 함수 호출 실패')
    }

    if (relationData?.memberType) {
      memberType.value = relationData.memberType
    }
  } catch (error) {
    console.error('회원 정보 로딩 에러:', error)
    memberType.value = '비회원'
    customerName.value = '고객'
  }
}

const increaseQuantity = (key) => {
  quantities.value[key] = (quantities.value[key] ?? 1) + 1
}

const decreaseQuantity = (key) => {
  const currentQuantity = quantities.value[key] ?? 1
  quantities.value[key] = Math.max(1, currentQuantity - 1)
}

const loadProductOptions = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (productError) {
      throw productError
    }
    productName.value = productData.name || '참외'

    const { data: optionData, error: optionError } = await supabase
      .from('product_options')
      .select('id, name, price')
      .eq('product_id', productData.id)
      .order('id', { ascending: true })

    if (optionError) {
      throw optionError
    }

    products.value = (optionData || []).map((option, index) => ({
      key: option.id,
      label: option.name,
      guestPrice: option.price,
      memberPrice: Math.max(option.price - 2000, 0),
      imagePath: detailImagePaths[index] ?? '',
    }))

    quantities.value = products.value.reduce((acc, option) => {
      acc[option.key] = 1
      return acc
    }, {})

    selectedWeights.value = []
    activeTab.value = products.value[0]?.key ?? null
  } catch (error) {
    console.error('상품 옵션 로딩 에러:', error)
    loadError.value = '상품 옵션을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadProductOptions(), loadMemberInfo()])

  if (products.value.length > 0) {
    await setActiveProduct(products.value[0].key, false)
  }
})

const openCheckoutOverlay = () => {
  if (!selectedWeights.value.length) {
    alert('옵션을 1개 이상 선택해 주세요.')
    return
  }

  const selectedProducts = products.value.filter((product) =>
    selectedWeights.value.includes(product.key),
  )
  const totalQuantity = selectedProducts.reduce(
    (sum, product) => sum + (quantities.value[product.key] ?? 1),
    0,
  )

  const optionSummary = selectedProducts
    .map((product) => `${product.label} ${quantities.value[product.key] ?? 1}개`)
    .join(', ')

  checkoutOrder.value = {
    product_id: 0,
    product_name: productName.value,
    option_id: 0,
    option_name: optionSummary,
    quantity: totalQuantity,
    total_amount: totalPrice.value,
    recipient_name: '',
    recipient_phone: '',
    recipient_address: '',
    recipient_detail_address: '',
    saved_full_address: '',
    recipient_zonecode: '',
    recipient_base_address: '',
    delivery_message: '',
  }

  selectedZonecode.value = ''
  selectedBaseAddress.value = ''
  isCheckoutOpen.value = true
}

function handleSelectAddress(addressItem) {
  selectedZonecode.value = addressItem.zonecode
  selectedBaseAddress.value = addressItem.address
  isAddressSearchOpen.value = false
}

const generateOrderCode = () => {
  return `gomama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
const openTossPayment = async ({ orderCode, amount, orderName, customerName }) => {
  try {
    if (typeof window.TossPayments !== 'function') {
      throw new Error('TossPayments SDK가 로드되지 않았습니다.')
    }

    const tossPayments = window.TossPayments(tossClientKey)
    const payment = tossPayments.payment({
      customerKey: 'guest',
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

async function handleConfirmOrder(checkoutPayload) {
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

  isCheckoutOpen.value = false

  await openTossPayment({
    orderCode,
    amount: checkoutPayload.total_amount,
    orderName: `${checkoutPayload.product_name} ${checkoutPayload.option_name}`,
    customerName: checkoutPayload.recipient_name,
  })

  isSubmittingOrder.value = false
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto max-w-[430px] pb-4">
      <!-- 로딩 -->
      <div v-if="isLoading" class="gm-loading-overlay">
        <div class="gm-loading-box">
          <div class="gm-loading-logo">고마마</div>

          <h2 class="gm-loading-title">상품 정보를 불러오는 중입니다</h2>

          <p class="gm-loading-text">신선한 참외 상품을 준비하고 있어요.</p>

          <div class="gm-loading-spinner"></div>
        </div>
      </div>

      <!-- 에러 -->
      <div v-else-if="loadError" class="gm-section gm-mt-16">
        <div class="gm-notice gm-notice-danger">
          <span class="gm-notice-icon">!</span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title">상품 로딩 실패</strong>
            <p class="gm-notice-text">
              {{ loadError }}
            </p>
          </div>
        </div>
      </div>

      <template v-else>
        <!-- 상품 이미지 헤더 -->
        <div class="gm-product-hero">
          <div class="gm-product-image-wrap relative">
            <div
              ref="heroScrollRef"
              class="gm-no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
              @scroll="handleHeroScroll"
            >
              <div
                v-for="product in products"
                :key="`hero-${product.key}`"
                class="h-full min-w-full snap-center"
              >
                <img
                  v-if="product.imagePath"
                  :src="product.imagePath"
                  :alt="`${product.label} 상품 이미지`"
                  class="gm-product-image"
                />

                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500"
                >
                  이미지가 준비되지 않았습니다.
                </div>
              </div>
            </div>

            <div class="gm-product-image-badges">
              <span class="gm-badge gm-badge-primary">오늘 수확</span>
              <span class="gm-badge gm-badge-soft">정품 선별</span>
            </div>

            <!-- 이미지 숫자 라벨 -->
            <div class="absolute bottom-4 right-4">
              <span
                class="rounded-full bg-black/55 px-3 py-1 text-xs font-extrabold text-white backdrop-blur"
              >
                {{ activeImageIndex + 1 }} / {{ products.length }}
              </span>
            </div>
          </div>

          <div class="gm-product-hero-body">
            <span class="gm-product-kicker">고마마정품</span>

            <h1 class="gm-product-title">
              {{ productName }}
            </h1>

            <p class="gm-product-subtitle">
              성주 농가에서 직접 선별한 신선한 참외를 산지에서 바로 보내드립니다.
            </p>

            <div class="gm-product-price-row">
              <strong class="gm-product-price">
                {{
                  activeProduct
                    ? formatPrice(isMember ? activeProduct.memberPrice : activeProduct.guestPrice)
                    : 0
                }}원
                <span class="gm-product-price-unit">부터</span>
              </strong>

              <span class="gm-product-origin"> 경북 성주 </span>
            </div>
          </div>
        </div>

        <div style="height: 18px"></div>

        <!-- 회원 상태 안내 -->
        <div class="gm-section">
          <div class="gm-notice" :class="isMember ? 'gm-notice-success' : 'gm-notice-info'">
            <span class="gm-notice-icon">
              {{ isMember ? '✓' : 'i' }}
            </span>

            <div class="gm-notice-content">
              <strong class="gm-notice-title">
                {{ isMember ? '회원가 적용 안내' : '비회원 주문 안내' }}
              </strong>
              <p class="gm-notice-text">
                {{ memberStatusMessage }}
              </p>
            </div>
          </div>
        </div>

        <!-- 상품 옵션 선택 -->
        <div class="gm-section">
          <div class="gm-card">
            <h3 class="gm-card-title">상품 옵션 선택</h3>

            <p class="gm-card-text gm-card-muted gm-mb-16">
              주문하실 참외 옵션을 선택해 주세요. 여러 옵션을 함께 선택할 수 있어요.
            </p>

            <div class="gm-option-list">
              <label
                v-for="product in products"
                :key="`option-${product.key}`"
                class="gm-option-card"
              >
                <input
                  v-model="selectedWeights"
                  type="checkbox"
                  :value="product.key"
                  @change="setActiveProduct(product.key)"
                />

                <span class="gm-option-card-body">
                  <span class="flex items-start justify-between gap-3">
                    <span>
                      <span class="gm-option-title">
                        {{ product.label }}
                      </span>

                      <span class="gm-option-desc">
                        비회원가 {{ formatPrice(product.guestPrice) }}원
                      </span>

                      <span class="gm-option-price">
                        고정고객 {{ formatPrice(product.memberPrice) }}원
                      </span>
                    </span>

                    <span
                      v-if="selectedWeights.includes(product.key)"
                      class="gm-badge gm-badge-primary"
                    >
                      선택됨
                    </span>
                  </span>

                  <div
                    v-if="selectedWeights.includes(product.key)"
                    class="gm-card gm-card-soft gm-mt-16"
                  >
                    <div class="gm-qty-row">
                      <div class="gm-qty-info">
                        <span class="gm-qty-title">수량</span>
                        <span class="gm-qty-desc"> {{ product.label }} 주문 수량 </span>
                      </div>

                      <div class="gm-qty">
                        <button
                          type="button"
                          class="gm-qty-button"
                          :disabled="(quantities[product.key] ?? 1) <= 1"
                          @click.prevent="decreaseQuantity(product.key)"
                        >
                          -
                        </button>

                        <span class="gm-qty-value">
                          {{ quantities[product.key] ?? 1 }}
                        </span>

                        <button
                          type="button"
                          class="gm-qty-button"
                          @click.prevent="increaseQuantity(product.key)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- 주문 요약 -->
        <div class="gm-section">
          <div class="gm-card">
            <h3 class="gm-card-title">주문 요약</h3>

            <p class="gm-card-text gm-card-muted gm-mb-16">
              선택한 옵션과 총 금액을 확인해 주세요.
            </p>

            <div v-if="selectedProducts.length > 0" class="gm-summary">
              <div
                v-for="product in selectedProducts"
                :key="`summary-${product.key}`"
                class="gm-summary-row"
              >
                <span class="gm-summary-label">
                  {{ product.label }} × {{ quantities[product.key] ?? 1 }}박스
                </span>

                <span class="gm-summary-value">
                  {{
                    formatPrice(
                      (isMember ? product.memberPrice : product.guestPrice) *
                        (quantities[product.key] ?? 1),
                    )
                  }}원
                </span>
              </div>

              <div class="gm-summary-divider"></div>

              <div class="gm-summary-row gm-summary-total">
                <span class="gm-summary-label">총 금액</span>
                <span class="gm-summary-value"> {{ formatPrice(totalPrice) }}원 </span>
              </div>

              <span class="gm-summary-small"> 다음 단계에서 배송지와 결제 정보를 입력합니다. </span>
            </div>

            <div v-else class="gm-history-empty">
              <h4 class="gm-history-empty-title">선택된 옵션이 없어요</h4>

              <p class="gm-history-empty-text">주문할 참외 옵션을 1개 이상 선택해 주세요.</p>
            </div>
          </div>
        </div>

        <!-- 하단 버튼 공간 확보 -->
        <div class="gm-bottom-spacer"></div>

        <!-- 하단 고정 주문 버튼 -->
        <div class="gm-bottom-action">
          <div class="gm-bottom-action-inner">
            <div class="gm-bottom-action-row">
              <div class="gm-bottom-action-price">
                <span class="gm-bottom-action-label">
                  {{ bottomActionLabel }}
                </span>

                <strong class="gm-bottom-action-amount"> {{ formatPrice(totalPrice) }}원 </strong>
              </div>

              <button
                type="button"
                class="gm-button gm-button-lg gm-button-pill gm-button-primary"
                :disabled="!selectedWeights.length"
                @click="openCheckoutOverlay"
              >
                주문하기
              </button>
            </div>
          </div>
        </div>
      </template>
      <BaseFullOverlay v-model="isCheckoutOpen">
        <CheckoutOverlayContent
          v-if="checkoutOrder"
          :order="checkoutOrder"
          :is-submitting="isSubmittingOrder"
          :zonecode="selectedZonecode"
          :base-address="selectedBaseAddress"
          @open-address-search="isAddressSearchOpen = true"
          @confirm-order="handleConfirmOrder"
        />
      </BaseFullOverlay>

      <BaseFullOverlay v-model="isAddressSearchOpen">
        <AddressSearchOverlayContent @select-address="handleSelectAddress" />
      </BaseFullOverlay>
    </div>
  </div>
</template>
