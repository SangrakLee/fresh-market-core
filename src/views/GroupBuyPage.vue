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
const isGroupBuySheetOpen = ref(false)
const groupBuyStep = ref(1)

const openGroupBuySheet = () => {
  groupBuyStep.value = 1
  groupBuyError.value = ''
  groupBuySuccess.value = ''
  isGroupBuySheetOpen.value = true
}

const closeGroupBuySheet = async () => {
  isGroupBuySheetOpen.value = false

  if (groupBuyStep.value === 5) {
    await loadMyGroupBuys()
  }
}

const nextGroupBuyStep = () => {
  if (groupBuyStep.value === 2) {
    hostQuantity.value = Math.min(hostQuantity.value, totalQuantity.value)
  }

  if (groupBuyStep.value === 3) {
    shareLinkCount.value = autoShareLinkCount.value
  }

  groupBuyStep.value += 1
}

const prevGroupBuyStep = () => {
  if (groupBuyStep.value <= 1) return
  groupBuyStep.value -= 1
}

const totalQuantity = ref(2)
const hostQuantity = ref(1)
const autoShareLinkCount = computed(() => {
  return Math.max(totalQuantity.value - hostQuantity.value, 0)
})
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
    groupBuyStep.value = 5
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
      <!-- 메인 소개 카드 -->
      <section class="gm-section">
        <div class="gm-card gm-card-gradient-green">
          <div class="gm-mb-16">
            <span class="gm-badge gm-badge-white">고마마 공동구매</span>
          </div>

          <h1 class="gm-card-title">
            친구와 같이 사면<br />
            더 저렴해요
          </h1>

          <p class="gm-card-text">
            총 수량을 정하고 친구에게 링크를 공유하세요. 각자 주소 입력과 결제를 진행할 수 있어요.
          </p>

          <div class="mt-4 flex flex-wrap gap-2">
            <span class="gm-badge gm-badge-white">성주 참외</span>
            <span class="gm-badge gm-badge-white">링크 공유</span>
            <span class="gm-badge gm-badge-white">개별 결제</span>
          </div>
        </div>
      </section>

      <!-- 할인 안내 -->
      <section class="gm-section">
        <div class="gm-notice" :class="isKakaoFriend ? 'gm-notice-success' : 'gm-notice-info'">
          <span class="gm-notice-icon">
            {{ isKakaoFriend ? '✓' : 'i' }}
          </span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title"> 공동구매 할인 안내 </strong>

            <p class="gm-notice-text">
              {{ discountLabel }}
            </p>

            <p class="gm-notice-text mt-1">
              {{
                isKakaoFriend
                  ? '카카오 친구 추가 할인도 적용돼요.'
                  : '로그인하면 카카오 친구 할인을 확인할 수 있어요.'
              }}
            </p>
          </div>
        </div>
      </section>

      <!-- 시작 버튼 카드 -->
      <section class="gm-section">
        <div class="gm-card">
          <h2 class="gm-card-title">공동구매를 시작해볼까요?</h2>

          <p class="gm-card-text gm-card-muted gm-mb-16">
            상품 선택부터 링크 생성까지 단계별로 진행합니다.
          </p>

          <button
            type="button"
            class="gm-button gm-button-full gm-button-lg gm-button-pill gm-button-primary"
            :disabled="isLoading || !!loadError"
            @click="openGroupBuySheet"
          >
            공동구매 시작하기
          </button>

          <button
            type="button"
            class="gm-button gm-button-full gm-button-md gm-button-pill gm-button-outline gm-mt-12"
            @click="loadMyGroupBuys"
          >
            내 공동구매 새로고침
          </button>
        </div>
      </section>

      <!-- 로딩 / 에러 -->
      <section v-if="isLoading" class="gm-section">
        <div class="gm-notice gm-notice-info">
          <span class="gm-notice-icon">i</span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title">불러오는 중</strong>
            <p class="gm-notice-text">공동구매 상품 정보를 불러오고 있어요.</p>
          </div>
        </div>
      </section>

      <section v-if="loadError" class="gm-section">
        <div class="gm-notice gm-notice-danger">
          <span class="gm-notice-icon">!</span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title">로딩 실패</strong>
            <p class="gm-notice-text">
              {{ loadError }}
            </p>
          </div>
        </div>
      </section>

      <!-- 내 공동구매 간단 보기 -->
      <section class="gm-section">
        <div class="gm-card">
          <h2 class="gm-card-title">내 공동구매</h2>

          <p class="gm-card-text gm-card-muted gm-mb-16">
            생성한 공동구매를 간단히 확인할 수 있어요.
          </p>

          <div v-if="isLoadingMyGroupBuys" class="gm-history-empty">
            <h4 class="gm-history-empty-title">불러오는 중...</h4>
            <p class="gm-history-empty-text">내 공동구매 목록을 확인하고 있어요.</p>
          </div>

          <div v-else-if="!myGroupBuys.length" class="gm-history-empty">
            <h4 class="gm-history-empty-title">아직 공동구매가 없어요</h4>
            <p class="gm-history-empty-text">공동구매를 만들면 이곳에 표시됩니다.</p>
          </div>

          <div v-else class="gm-history-list">
            <article
              v-for="group in myGroupBuys.slice(0, 2)"
              :key="group.id"
              class="gm-history-card"
            >
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
                  <span class="gm-history-value">{{ group.total_quantity }}개</span>
                </div>

                <div class="gm-history-row">
                  <span class="gm-history-label">공유 링크</span>
                  <span class="gm-history-value">{{ group.share_slot_count }}개</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- 2단계에서 여기에 오버레이 넣을 예정 -->
      <div v-if="isGroupBuySheetOpen" class="gm-overlay" @click.self="closeGroupBuySheet">
        <div class="gm-overlay-panel">
          <div class="gm-overlay-header">
            <h2 class="gm-overlay-title">
              {{
                groupBuyStep === 1
                  ? '상품 선택'
                  : groupBuyStep === 2
                    ? '총 수량 선택'
                    : groupBuyStep === 3
                      ? '내 결제 수량'
                      : groupBuyStep === 4
                        ? '공동구매 확인'
                        : groupBuyStep === 5
                          ? '공동구매 완료'
                          : '공동구매 시작'
              }}
            </h2>

            <button type="button" class="gm-overlay-close" @click="closeGroupBuySheet">×</button>
          </div>

          <div class="gm-overlay-body">
            <div v-if="groupBuyStep === 1">
              <div class="gm-notice gm-notice-info gm-mb-16">
                <span class="gm-notice-icon">i</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 어떤 참외로 공동구매할까요? </strong>

                  <p class="gm-notice-text">공동구매할 상품 옵션을 먼저 선택해 주세요.</p>
                </div>
              </div>

              <div class="gm-option-list">
                <label v-for="option in options" :key="option.id" class="gm-option-card">
                  <input v-model="selectedOptionId" type="radio" :value="option.id" />

                  <span class="gm-option-card-body">
                    <span class="flex items-start justify-between gap-3">
                      <span>
                        <span class="gm-option-title">
                          {{ product?.name || '고마마정품' }} {{ option.name }}
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
            <div v-else-if="groupBuyStep === 2">
              <div class="gm-notice gm-notice-info gm-mb-16">
                <span class="gm-notice-icon">i</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 총 몇 박스로 공동구매할까요? </strong>

                  <p class="gm-notice-text">친구들과 함께 주문할 전체 박스 수를 선택해 주세요.</p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-qty-row">
                  <div class="gm-qty-info">
                    <span class="gm-qty-title">총 공동구매 수량</span>
                    <span class="gm-qty-desc"> 최소 2박스부터 공동구매를 시작할 수 있어요. </span>
                  </div>

                  <div class="gm-qty">
                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="totalQuantity <= 2"
                      @click="totalQuantity = Math.max(2, totalQuantity - 1)"
                    >
                      -
                    </button>

                    <span class="gm-qty-value">
                      {{ totalQuantity }}
                    </span>

                    <button type="button" class="gm-qty-button" @click="totalQuantity += 1">
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div class="gm-notice gm-notice-success gm-mt-16">
                <span class="gm-notice-icon">✓</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 현재 설정 </strong>

                  <p class="gm-notice-text">총 {{ totalQuantity }}박스로 공동구매를 진행합니다.</p>
                </div>
              </div>
            </div>
            <div v-else-if="groupBuyStep === 3">
              <div class="gm-notice gm-notice-info gm-mb-16">
                <span class="gm-notice-icon">i</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 나는 몇 박스를 결제할까요? </strong>

                  <p class="gm-notice-text">
                    나머지 수량은 친구에게 보낼 초대 링크로 자동 생성돼요.
                  </p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-qty-row">
                  <div class="gm-qty-info">
                    <span class="gm-qty-title">내 결제 수량</span>
                    <span class="gm-qty-desc"> 내가 직접 결제할 박스 수입니다. </span>
                  </div>

                  <div class="gm-qty">
                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="hostQuantity <= 1"
                      @click="hostQuantity = Math.max(1, hostQuantity - 1)"
                    >
                      -
                    </button>

                    <span class="gm-qty-value">
                      {{ hostQuantity }}
                    </span>

                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="hostQuantity >= totalQuantity"
                      @click="hostQuantity = Math.min(totalQuantity, hostQuantity + 1)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div class="gm-notice gm-notice-success gm-mt-16">
                <span class="gm-notice-icon">✓</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 초대 링크 자동 생성 </strong>

                  <p class="gm-notice-text">
                    총 {{ totalQuantity }}박스 중 내가 {{ hostQuantity }}박스를 결제하고, 친구에게
                    보낼 링크 {{ autoShareLinkCount }}개가 생성됩니다.
                  </p>
                </div>
              </div>
            </div>
            <div v-else-if="groupBuyStep === 4">
              <div class="gm-notice gm-notice-success gm-mb-16">
                <span class="gm-notice-icon">✓</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title"> 공동구매 내용을 확인해 주세요 </strong>

                  <p class="gm-notice-text">
                    아래 내용으로 공동구매를 만들고 초대 링크를 생성합니다.
                  </p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-summary">
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">상품</span>
                    <span class="gm-summary-value">
                      {{ product?.name || '고마마정품' }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">옵션</span>
                    <span class="gm-summary-value">
                      {{ selectedOption?.name || '-' }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">총 수량</span>
                    <span class="gm-summary-value"> {{ totalQuantity }}박스 </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">내 결제 수량</span>
                    <span class="gm-summary-value"> {{ hostQuantity }}박스 </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">공유 링크</span>
                    <span class="gm-summary-value"> {{ autoShareLinkCount }}개 </span>
                  </div>

                  <div class="gm-summary-divider"></div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">기본 단가</span>
                    <span class="gm-summary-value">
                      {{ formatCurrency(baseUnitPrice) }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">개당 할인</span>
                    <span class="gm-summary-value gm-summary-discount">
                      - {{ formatCurrency(totalDiscountPerItem) }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">공동구매 총액</span>
                    <span class="gm-summary-value">
                      {{ formatCurrency(paymentTotal) }}
                    </span>
                  </div>

                  <div class="gm-summary-divider"></div>

                  <div class="gm-summary-row gm-summary-total">
                    <span class="gm-summary-label">내 예상 결제금액</span>
                    <span class="gm-summary-value">
                      {{
                        formatCurrency(
                          Math.max(baseUnitPrice - totalDiscountPerItem, 0) * hostQuantity,
                        )
                      }}
                    </span>
                  </div>

                  <span class="gm-summary-small">
                    친구들은 생성된 초대 링크에서 각자 주소 입력과 결제를 진행합니다.
                  </span>
                </div>
              </div>

              <div v-if="groupBuyError" class="gm-notice gm-notice-danger gm-mt-16">
                <span class="gm-notice-icon">!</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title">생성 실패</strong>
                  <p class="gm-notice-text">
                    {{ groupBuyError }}
                  </p>
                </div>
              </div>
            </div>
            <div v-else-if="groupBuyStep === 5">
              <div class="gm-complete">
                <div class="gm-complete-icon">✓</div>

                <h2 class="gm-complete-title">
                  공동구매가<br />
                  만들어졌어요
                </h2>

                <p class="gm-complete-text">
                  친구에게 초대 링크를 공유하고<br />
                  각자 주소 입력과 결제를 진행하면 됩니다.
                </p>
              </div>

              <div v-if="groupBuySuccess" class="gm-notice gm-notice-success gm-mb-16">
                <span class="gm-notice-icon">✓</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title">생성 완료</strong>
                  <p class="gm-notice-text">
                    {{ groupBuySuccess }}
                  </p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-summary">
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">상품</span>
                    <span class="gm-summary-value">
                      {{ product?.name || '고마마정품' }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">옵션</span>
                    <span class="gm-summary-value">
                      {{ selectedOption?.name || '-' }}
                    </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">총 수량</span>
                    <span class="gm-summary-value"> {{ totalQuantity }}박스 </span>
                  </div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">공유 링크</span>
                    <span class="gm-summary-value"> {{ autoShareLinkCount }}개 </span>
                  </div>
                </div>
              </div>

              <div class="gm-notice gm-notice-info gm-mt-16">
                <span class="gm-notice-icon">i</span>

                <div class="gm-notice-content">
                  <strong class="gm-notice-title">
                    링크 공유는 내 공동구매에서 할 수 있어요
                  </strong>

                  <p class="gm-notice-text">
                    아래 버튼을 누르면 생성된 공동구매 목록에서 링크 복사와 공유를 할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="gm-overlay-footer">
            <div class="gm-bottom-action-row">
              <button
                v-if="groupBuyStep > 1 && groupBuyStep < 5"
                type="button"
                class="gm-button gm-button-lg gm-button-pill gm-button-outline"
                @click="prevGroupBuyStep"
              >
                이전
              </button>

              <button
                type="button"
                class="gm-button gm-button-lg gm-button-pill gm-button-primary"
                style="flex: 1"
                :disabled="(groupBuyStep === 1 && !selectedOptionId) || isCreatingGroupBuy"
                @click="
                  groupBuyStep === 4
                    ? createGroupBuy()
                    : groupBuyStep === 5
                      ? closeGroupBuySheet()
                      : nextGroupBuyStep()
                "
              >
                {{
                  groupBuyStep === 4
                    ? isCreatingGroupBuy
                      ? '공동구매 생성 중...'
                      : '공동구매 만들기'
                    : groupBuyStep === 5
                      ? '내 공동구매 보기'
                      : '다음'
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
