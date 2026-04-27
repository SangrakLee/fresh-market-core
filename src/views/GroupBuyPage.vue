<script setup>
/* global TossPayments */
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

const product = ref(null)
const options = ref([])
const selectedOptionId = ref(null)
const isKakaoFriend = ref(false)
const isLoading = ref(true)
const loadError = ref('')

const groupBuyError = ref('')
const groupBuySuccess = ref('')
const isCreatingGroupBuy = ref(false)
const deletingGroupBuyId = ref(null)
const payingHostMemberId = ref(null)
const isLoadingMyGroupBuys = ref(false)
const myGroupBuys = ref([])

const totalQuantity = ref(2)
const hostQuantity = ref(1)
const shareLinkCount = ref(1)
const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

const selectedOption = computed(() => {
  return options.value.find((option) => option.id === selectedOptionId.value) || null
})

const baseUnitPrice = computed(() => selectedOption.value?.price || 0)

const groupDiscountPerItem = computed(() => {
  if (totalQuantity.value >= 10 && totalQuantity.value <= 19) return 3000
  if (totalQuantity.value >= 5 && totalQuantity.value <= 9) return 2000
  return 0
})

const kakaoFriendDiscountPerItem = computed(() => (isKakaoFriend.value ? 1000 : 0))

const totalDiscountPerItem = computed(() => {
  return groupDiscountPerItem.value + kakaoFriendDiscountPerItem.value
})

const finalUnitPrice = computed(() => {
  return Math.max(baseUnitPrice.value - totalDiscountPerItem.value, 0)
})

const originTotal = computed(() => baseUnitPrice.value * totalQuantity.value)
const discountTotal = computed(() => totalDiscountPerItem.value * totalQuantity.value)
const paymentTotal = computed(() => finalUnitPrice.value * totalQuantity.value)

const shareLinkBase = computed(() => `${window.location.origin}/group-buy/join`)
const isSplitRuleValid = computed(() => {
  return hostQuantity.value + shareLinkCount.value === totalQuantity.value
})

const discountLabel = computed(() => {
  if (groupDiscountPerItem.value === 3000) return '공동구매 10~19개 구간 적용 (개당 3,000원 할인)'
  if (groupDiscountPerItem.value === 2000) return '공동구매 5~9개 구간 적용 (개당 2,000원 할인)'
  return '공동구매 할인 미적용 (5개 이상부터 적용)'
})

const formatCurrency = (price) => `${price.toLocaleString()}원`

const normalizeInteger = (value, minimum = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return minimum
  return Math.max(minimum, Math.floor(parsed))
}

const normalizeCounts = () => {
  totalQuantity.value = normalizeInteger(totalQuantity.value, 1)
  hostQuantity.value = normalizeInteger(hostQuantity.value, 1)
  shareLinkCount.value = normalizeInteger(shareLinkCount.value, 0)
}

const generateInviteToken = () => {
  const randomPart = crypto.randomUUID().replaceAll('-', '').slice(0, 18)
  const timePart = Date.now().toString(36)
  return `${timePart}${randomPart}`
}

const buildInviteUrl = (inviteToken) => `${shareLinkBase.value}?token=${inviteToken}`

const shareOneInviteLink = async (inviteToken) => {
  const url = buildInviteUrl(inviteToken)
  const text = [
    '[고마마 공동구매 참여 링크]',
    `[상품] ${product.value?.name || '-'} / ${selectedOption.value?.name || '-'}`,
    `아래 링크로 주소 입력 + 결제 부탁드려요.`,
    url,
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: '공동구매 참여 요청',
        text,
      })
      return
    } catch {
      // fallback to clipboard
    }
  }

  await navigator.clipboard.writeText(text)
  alert('해당 참여자용 링크 문구를 복사했어요.')
}

const loadMyGroupBuys = async () => {
  isLoadingMyGroupBuys.value = true

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const userId = sessionData.session?.user?.id
    if (!userId) {
      myGroupBuys.value = []
      return
    }

    const { data, error } = await supabase
      .from('group_buys')
      .select(
        'id, product_id, option_id, status, total_quantity, host_quantity, share_slot_count, created_at, products:product_id(name), product_options:option_id(name,price), group_buy_members(id, slot_no, is_host, quantity, invite_token, receiver, phone, address, payment_status)',
      )
      .eq('host_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    myGroupBuys.value = data || []
  } catch (error) {
    console.error('내 공동구매 목록 조회 에러:', error)
  } finally {
    isLoadingMyGroupBuys.value = false
  }
}

const createGroupBuy = async () => {
  normalizeCounts()
  groupBuyError.value = ''
  groupBuySuccess.value = ''

  if (!selectedOption.value || !product.value?.id) {
    groupBuyError.value = '상품/키로수를 먼저 선택해 주세요.'
    return
  }

  if (!isSplitRuleValid.value) {
    groupBuyError.value = '내 결제 수량 + 공유 링크 수가 총 수량과 같아야 해요.'
    return
  }

  isCreatingGroupBuy.value = true

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const user = sessionData.session?.user
    if (!user) {
      groupBuyError.value = '공동구매 생성은 로그인 후 이용할 수 있어요.'
      return
    }

    const { data: createdGroupBuy, error: createError } = await supabase
      .from('group_buys')
      .insert({
        host_user_id: user.id,
        product_id: product.value.id,
        option_id: selectedOption.value.id,
        total_quantity: totalQuantity.value,
        host_quantity: hostQuantity.value,
        share_slot_count: shareLinkCount.value,
        status: 'collecting',
      })
      .select('id')
      .single()

    if (createError) throw createError

    const members = [
      {
        group_buy_id: createdGroupBuy.id,
        slot_no: 1,
        is_host: true,
        quantity: hostQuantity.value,
        payment_status: 'pending',
      },
      ...Array.from({ length: shareLinkCount.value }, (_, index) => ({
        group_buy_id: createdGroupBuy.id,
        slot_no: index + 2,
        is_host: false,
        quantity: 1,
        invite_token: generateInviteToken(),
        payment_status: 'pending',
      })),
    ]

    const { data: createdMembers, error: memberError } = await supabase
      .from('group_buy_members')
      .insert(members)
      .select('slot_no, invite_token')

    if (memberError) throw memberError

    const invitedCount = (createdMembers || []).filter((member) => member.invite_token).length
    groupBuySuccess.value = `공동구매를 생성했어요. 아래 목록에서 ${invitedCount}명에게 링크를 각각 공유해 주세요.`
    await loadMyGroupBuys()
  } catch (error) {
    console.error('공동구매 생성 에러:', error)
    groupBuyError.value = '공동구매 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isCreatingGroupBuy.value = false
  }
}

const copyMemberLink = async (inviteToken) => {
  try {
    await navigator.clipboard.writeText(buildInviteUrl(inviteToken))
    alert('링크를 복사했어요.')
  } catch {
    alert('링크 복사에 실패했어요.')
  }
}

const deleteGroupBuy = async (groupBuyId) => {
  const confirmed = window.confirm(
    '이 공동구매를 삭제할까요? 관련 링크/멤버 정보도 함께 삭제됩니다.',
  )
  if (!confirmed) return

  groupBuyError.value = ''
  groupBuySuccess.value = ''
  deletingGroupBuyId.value = groupBuyId

  try {
    const { data: deletedRows, error } = await supabase
      .from('group_buys')
      .delete()
      .eq('id', groupBuyId)
      .select('id')
    if (error) throw error
    if (!deletedRows?.length) {
      throw new Error('삭제 권한이 없거나 RLS 정책이 적용되지 않았습니다.')
    }

    groupBuySuccess.value = '공동구매를 삭제했어요.'
    await loadMyGroupBuys()
  } catch (error) {
    console.error('공동구매 삭제 에러:', error)
    groupBuyError.value = '공동구매 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    deletingGroupBuyId.value = null
  }
}

const buildGroupBuyOrderCode = (memberId) => {
  return `gbm_${memberId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const openTossPayment = async ({ orderCode, totalAmount, orderName, customerName }) => {
  const tossPayments = TossPayments(tossClientKey)
  const payment = tossPayments.payment({
    customerKey: 'group-buy-host',
  })

  await payment.requestPayment({
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: totalAmount,
    },
    orderId: orderCode,
    orderName,
    customerName,
    successUrl: `${window.location.origin}/payment/success`,
    failUrl: `${window.location.origin}/payment/fail`,
  })
}

const payHostMember = async (group, hostMember) => {
  const receiver = prompt('수령인 이름을 입력해 주세요.', hostMember.receiver || '')?.trim() || ''
  if (!receiver) return

  const phone = prompt('연락처를 입력해 주세요.', hostMember.phone || '')?.trim() || ''
  if (!phone) return

  const address = prompt('주소를 입력해 주세요.', hostMember.address || '')?.trim() || ''
  if (!address) return

  const unitPrice = Number(group?.product_options?.price || 0)
  const quantity = Number(hostMember.quantity || 1)
  const totalAmount = unitPrice * quantity
  const productId = Number(group?.product_id || 0)
  const optionId = Number(group?.option_id || 0)
  if (totalAmount <= 0) {
    alert('결제 금액 계산에 실패했어요. 옵션 가격을 확인해 주세요.')
    return
  }
  if (!productId || !optionId) {
    alert('상품/옵션 정보가 누락되어 결제를 진행할 수 없어요.')
    return
  }

  const orderCode = buildGroupBuyOrderCode(hostMember.id)
  payingHostMemberId.value = hostMember.id

  try {
    const { error } = await supabase.from('orders').insert([
      {
        product_id: productId,
        product_name: group?.products?.name || product.value?.name || '공동구매 상품',
        option_id: optionId,
        option_name: group?.product_options?.name || selectedOption.value?.name || '옵션',
        quantity,
        total_amount: totalAmount,
        recipient_name: receiver,
        recipient_phone: phone,
        recipient_address: address,
        recipient_zonecode: '',
        recipient_base_address: '',
        recipient_detail_address: address,
        delivery_message: '공동구매 주최자 결제',
        user_id: null,
        order_code: orderCode,
        order_status: 'pending',
      },
    ])

    if (error) throw error

    await openTossPayment({
      orderCode,
      totalAmount,
      orderName: `[공동구매-주최자] ${group?.products?.name || '공동구매 상품'} ${group?.product_options?.name || ''}`,
      customerName: receiver,
    })
  } catch (error) {
    console.error('주최자 결제 준비 에러:', error)
    alert('주최자 결제 준비 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.')
  } finally {
    payingHostMemberId.value = null
  }
}

const loadGroupBuyData = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const [{ data: productData, error: productError }, { data: sessionData, error: sessionError }] =
      await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).limit(1).single(),
        supabase.auth.getSession(),
      ])

    if (productError) throw productError
    if (sessionError) throw sessionError

    product.value = productData
    isKakaoFriend.value = Boolean(sessionData?.session?.user)

    const { data: optionData, error: optionError } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', productData.id)
      .order('id', { ascending: true })

    if (optionError) throw optionError

    options.value = optionData || []
    selectedOptionId.value = options.value[0]?.id || null
  } catch (error) {
    console.error('공동구매 데이터 로딩 에러:', error)
    loadError.value = '공동구매 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadGroupBuyData()
  await loadMyGroupBuys()
})
</script>

<template>
  <div class="min-h-screen bg-[#f7f8f9] pb-28 pt-5 text-black">
    <div class="mx-auto w-full max-w-[430px]">
      <!-- 상단 히어로 -->
      <section class="gm-section">
        <div class="gm-card gm-card-gradient-green">
          <div class="gm-mb-16">
            <span class="gm-badge gm-badge-white">공동구매</span>
          </div>

          <h1 class="gm-card-title">같이 사면 더 저렴해요</h1>

          <p class="gm-card-text">
            총 수량을 정하고, 친구에게 링크를 공유하세요. 참여자별 결제 상태까지 한 번에 확인할 수
            있어요.
          </p>

          <div class="mt-4 flex flex-wrap gap-2">
            <span class="gm-badge gm-badge-white">공유 링크</span>
            <span class="gm-badge gm-badge-white">개별 결제</span>
            <span class="gm-badge gm-badge-white">카카오 할인</span>
          </div>
        </div>
      </section>

      <!-- 로딩 -->
      <section v-if="isLoading" class="gm-section">
        <div class="gm-card">
          <div class="gm-loading-box" style="width: 100%; box-shadow: none">
            <div class="gm-loading-logo">고마마</div>

            <h2 class="gm-loading-title">공동구매 정보를 불러오는 중이에요</h2>

            <p class="gm-loading-text">상품과 옵션 정보를 준비하고 있어요.</p>

            <div class="gm-loading-spinner"></div>
          </div>
        </div>
      </section>

      <!-- 에러 -->
      <section v-else-if="loadError" class="gm-section">
        <div class="gm-notice gm-notice-danger">
          <span class="gm-notice-icon">!</span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title">공동구매 로딩 실패</strong>
            <p class="gm-notice-text">
              {{ loadError }}
            </p>
          </div>
        </div>
      </section>

      <template v-else>
        <!-- 할인 안내 -->
        <section class="gm-section">
          <div class="gm-notice" :class="isKakaoFriend ? 'gm-notice-success' : 'gm-notice-info'">
            <span class="gm-notice-icon">
              {{ isKakaoFriend ? '✓' : 'i' }}
            </span>

            <div class="gm-notice-content">
              <strong class="gm-notice-title">공동구매 할인 안내</strong>

              <p class="gm-notice-text">
                {{ discountLabel }}
              </p>

              <p v-if="isKakaoFriend" class="gm-notice-text mt-1">
                카카오 친구 추가 할인: 개당 1,000원
              </p>

              <p v-else class="gm-notice-text mt-1">비회원은 카카오 친구 할인이 적용되지 않아요.</p>
            </div>
          </div>
        </section>

        <!-- 상품/키로수 선택 -->
        <section class="gm-section">
          <div class="gm-card">
            <h2 class="gm-card-title">상품 옵션 선택</h2>

            <p class="gm-card-text gm-card-muted gm-mb-16">
              {{ product?.name || '상품명 없음' }} 공동구매 옵션을 선택해 주세요.
            </p>

            <div class="gm-option-list">
              <label v-for="option in options" :key="option.id" class="gm-option-card">
                <input v-model="selectedOptionId" type="radio" :value="option.id" />

                <span class="gm-option-card-body">
                  <span class="flex items-start justify-between gap-3">
                    <span>
                      <span class="gm-option-title">
                        {{ option.name }}
                      </span>

                      <span class="gm-option-desc">
                        기본가 {{ formatCurrency(option.price) }}
                      </span>

                      <span class="gm-option-price">
                        공동구매가
                        {{ formatCurrency(Math.max(option.price - totalDiscountPerItem, 0)) }}
                      </span>
                    </span>

                    <span v-if="selectedOptionId === option.id" class="gm-badge gm-badge-primary">
                      선택됨
                    </span>
                  </span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <!-- 공동구매 수량 설정 -->
        <section class="gm-section">
          <div class="gm-card">
            <h2 class="gm-card-title">공동구매 수량 설정</h2>

            <p class="gm-card-text gm-card-muted gm-mb-16">
              총 수량과 내가 결제할 수량, 공유할 링크 수를 맞춰 주세요.
            </p>

            <div class="grid gap-3">
              <div class="gm-card gm-card-soft">
                <label class="gm-field" style="margin-bottom: 0">
                  <span class="gm-field-label">
                    총 수량 <span class="gm-field-required">*</span>
                  </span>

                  <input
                    v-model.number="totalQuantity"
                    type="number"
                    min="1"
                    class="gm-input"
                    @change="normalizeCounts"
                  />

                  <span class="gm-field-helper"> 공동구매 전체 주문 수량입니다. </span>
                </label>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="gm-card gm-card-soft">
                  <label class="gm-field" style="margin-bottom: 0">
                    <span class="gm-field-label"> 내 결제 수량 </span>

                    <input
                      v-model.number="hostQuantity"
                      type="number"
                      min="1"
                      class="gm-input"
                      @change="normalizeCounts"
                    />
                  </label>
                </div>

                <div class="gm-card gm-card-soft">
                  <label class="gm-field" style="margin-bottom: 0">
                    <span class="gm-field-label"> 공유 링크 수 </span>

                    <input
                      v-model.number="shareLinkCount"
                      type="number"
                      min="0"
                      class="gm-input"
                      @change="normalizeCounts"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div
              class="gm-notice gm-mt-16"
              :class="isSplitRuleValid ? 'gm-notice-success' : 'gm-notice-danger'"
            >
              <span class="gm-notice-icon">
                {{ isSplitRuleValid ? '✓' : '!' }}
              </span>

              <div class="gm-notice-content">
                <strong class="gm-notice-title"> 수량 검증 </strong>

                <p class="gm-notice-text">
                  내 결제 {{ hostQuantity }} + 링크 {{ shareLinkCount }} = 총 {{ totalQuantity }}
                </p>

                <p v-if="!isSplitRuleValid" class="gm-notice-text mt-1">
                  내 결제 수량 + 공유 링크 수가 총 수량과 같아야 해요.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="gm-button gm-button-full gm-button-lg gm-button-pill gm-button-primary gm-mt-16"
              :disabled="isCreatingGroupBuy || !isSplitRuleValid"
              @click="createGroupBuy"
            >
              {{ isCreatingGroupBuy ? '생성 중...' : '공동구매 생성 & 링크 공유' }}
            </button>

            <div v-if="groupBuyError" class="gm-notice gm-notice-danger gm-mt-16">
              <span class="gm-notice-icon">!</span>

              <div class="gm-notice-content">
                <strong class="gm-notice-title">생성 실패</strong>
                <p class="gm-notice-text">{{ groupBuyError }}</p>
              </div>
            </div>

            <div v-if="groupBuySuccess" class="gm-notice gm-notice-success gm-mt-16">
              <span class="gm-notice-icon">✓</span>

              <div class="gm-notice-content">
                <strong class="gm-notice-title">생성 완료</strong>
                <p class="gm-notice-text">{{ groupBuySuccess }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 예상 결제 금액 -->
        <section class="gm-section">
          <div class="gm-card">
            <h2 class="gm-card-title">예상 결제 금액</h2>

            <p class="gm-card-text gm-card-muted gm-mb-16">
              공동구매 할인과 카카오 친구 할인을 반영한 예상 금액입니다.
            </p>

            <div class="gm-summary">
              <div class="gm-summary-row">
                <span class="gm-summary-label">선택 옵션</span>
                <span class="gm-summary-value">
                  {{ selectedOption?.name || '옵션 선택 필요' }}
                </span>
              </div>

              <div class="gm-summary-row">
                <span class="gm-summary-label">기본 단가</span>
                <span class="gm-summary-value">
                  {{ formatCurrency(baseUnitPrice) }}
                </span>
              </div>

              <div class="gm-summary-row">
                <span class="gm-summary-label">총 수량</span>
                <span class="gm-summary-value"> {{ totalQuantity }}개 </span>
              </div>

              <div class="gm-summary-row">
                <span class="gm-summary-label">기본 금액</span>
                <span class="gm-summary-value">
                  {{ formatCurrency(originTotal) }}
                </span>
              </div>

              <div class="gm-summary-row">
                <span class="gm-summary-label">개당 할인</span>
                <span class="gm-summary-value gm-summary-discount">
                  - {{ formatCurrency(totalDiscountPerItem) }}
                </span>
              </div>

              <div class="gm-summary-row">
                <span class="gm-summary-label">총 할인 금액</span>
                <span class="gm-summary-value gm-summary-discount">
                  - {{ formatCurrency(discountTotal) }}
                </span>
              </div>

              <div class="gm-summary-divider"></div>

              <div class="gm-summary-row gm-summary-total">
                <span class="gm-summary-label">최종 결제 금액</span>
                <span class="gm-summary-value">
                  {{ formatCurrency(paymentTotal) }}
                </span>
              </div>

              <span class="gm-summary-small">
                실제 참여자 결제 단계에서 주소와 결제 정보를 한 번 더 확인합니다.
              </span>
            </div>
          </div>
        </section>

        <!-- 내 공동구매 현황 -->
        <section class="gm-section">
          <div class="gm-card">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="gm-card-title">내 공동구매 현황</h2>

                <p class="gm-card-text gm-card-muted">
                  생성한 공동구매와 참여자별 결제 상태를 확인하세요.
                </p>
              </div>

              <button
                type="button"
                class="gm-button gm-button-sm gm-button-pill gm-button-outline"
                @click="loadMyGroupBuys"
              >
                새로고침
              </button>
            </div>

            <div v-if="isLoadingMyGroupBuys" class="gm-history-empty gm-mt-16">
              <h4 class="gm-history-empty-title">불러오는 중...</h4>

              <p class="gm-history-empty-text">내 공동구매 목록을 확인하고 있어요.</p>
            </div>

            <div v-else-if="!myGroupBuys.length" class="gm-history-empty gm-mt-16">
              <h4 class="gm-history-empty-title">생성한 공동구매가 없어요</h4>

              <p class="gm-history-empty-text">
                공동구매를 만들면 이곳에서 링크와 결제 상태를 확인할 수 있어요.
              </p>
            </div>

            <div v-else class="gm-history-list gm-mt-16">
              <article v-for="group in myGroupBuys" :key="group.id" class="gm-history-card">
                <div class="gm-history-head">
                  <div>
                    <strong class="gm-history-title">
                      {{ group.products?.name || '-' }}
                      / {{ group.product_options?.name || '-' }}
                    </strong>

                    <span class="gm-history-date">
                      {{ new Date(group.created_at).toLocaleString() }}
                    </span>
                  </div>

                  <span class="gm-history-status">
                    {{ group.status }}
                  </span>
                </div>

                <div class="gm-history-body">
                  <div class="gm-history-row">
                    <span class="gm-history-label">총 수량</span>
                    <span class="gm-history-value"> {{ group.total_quantity }}개 </span>
                  </div>

                  <div class="gm-history-row">
                    <span class="gm-history-label">내 결제</span>
                    <span class="gm-history-value"> {{ group.host_quantity }}개 </span>
                  </div>

                  <div class="gm-history-row">
                    <span class="gm-history-label">공유 링크</span>
                    <span class="gm-history-value"> {{ group.share_slot_count }}개 </span>
                  </div>
                </div>

                <div class="mt-3 grid gap-2">
                  <div
                    v-for="member in group.group_buy_members"
                    :key="member.id"
                    class="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div>
                        <p class="text-sm font-black text-gray-900">
                          #{{ member.slot_no }}
                          {{ member.is_host ? '주최자' : '참여자' }}
                        </p>

                        <p class="mt-1 text-xs font-semibold text-gray-500">
                          결제: {{ member.payment_status }}
                          · 주소:
                          {{ member.receiver && member.address ? '완료' : '미입력' }}
                        </p>
                      </div>

                      <template v-if="member.is_host">
                        <button
                          v-if="member.payment_status !== 'paid'"
                          type="button"
                          class="gm-button gm-button-sm gm-button-pill gm-button-outline"
                          :disabled="payingHostMemberId === member.id"
                          @click="payHostMember(group, member)"
                        >
                          {{ payingHostMemberId === member.id ? '준비중...' : '결제하기' }}
                        </button>

                        <span v-else class="gm-badge gm-badge-primary"> 결제완료 </span>
                      </template>

                      <template v-else-if="member.invite_token">
                        <div class="flex gap-2">
                          <button
                            type="button"
                            class="gm-button gm-button-sm gm-button-pill gm-button-outline"
                            @click="copyMemberLink(member.invite_token)"
                          >
                            복사
                          </button>

                          <button
                            type="button"
                            class="gm-button gm-button-sm gm-button-pill gm-button-primary"
                            @click="shareOneInviteLink(member.invite_token)"
                          >
                            공유
                          </button>
                        </div>
                      </template>

                      <span v-else class="gm-badge gm-badge-gray"> - </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="gm-button gm-button-full gm-button-md gm-button-pill gm-button-outline gm-mt-16"
                  :disabled="deletingGroupBuyId === group.id"
                  @click="deleteGroupBuy(group.id)"
                >
                  {{ deletingGroupBuyId === group.id ? '삭제 중...' : '공동구매 삭제' }}
                </button>
              </article>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
