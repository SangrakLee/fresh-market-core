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
const selectedGroup = ref(null)
const copiedMemberId = ref(null)

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
const hostPaymentTotal = computed(() => finalUnitPrice.value * hostQuantity.value)
const autoShareLinkCount = computed(() => Math.max(totalQuantity.value - hostQuantity.value, 0))

const shareLinkBase = computed(() => `${window.location.origin}/group-buy/join`)
const isSplitRuleValid = computed(() => {
  return hostQuantity.value + shareLinkCount.value === totalQuantity.value
})

const discountLabel = computed(() => {
  if (groupDiscountPerItem.value === 3000) return '공동구매 10~19개 구간 적용 (개당 3,000원 할인)'
  if (groupDiscountPerItem.value === 2000) return '공동구매 5~9개 구간 적용 (개당 2,000원 할인)'
  return '공동구매 할인 미적용 (5개 이상부터 적용)'
})

const sheetTitle = computed(() => {
  if (groupBuyStep.value === 1) return '상품 선택'
  if (groupBuyStep.value === 2) return '총 수량 선택'
  if (groupBuyStep.value === 3) return '내 결제 수량'
  if (groupBuyStep.value === 4) return '공동구매 확인'
  if (groupBuyStep.value === 5) return '공동구매 완료'
  return '공동구매 시작'
})

const formatCurrency = (price) => `${Number(price || 0).toLocaleString('ko-KR')}원`

const formatDateTime = (dateString) => {
  if (!dateString) return ''

  return new Date(dateString).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeInteger = (value, minimum = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return minimum
  return Math.max(minimum, Math.floor(parsed))
}

const normalizeCounts = () => {
  totalQuantity.value = normalizeInteger(totalQuantity.value, 2)
  hostQuantity.value = Math.min(normalizeInteger(hostQuantity.value, 1), totalQuantity.value)
  shareLinkCount.value = autoShareLinkCount.value
}

const decreaseTotalQuantity = () => {
  totalQuantity.value = Math.max(2, totalQuantity.value - 1)
  hostQuantity.value = Math.min(hostQuantity.value, totalQuantity.value)
  shareLinkCount.value = autoShareLinkCount.value
}

const increaseTotalQuantity = () => {
  totalQuantity.value += 1
  shareLinkCount.value = autoShareLinkCount.value
}

const decreaseHostQuantity = () => {
  hostQuantity.value = Math.max(1, hostQuantity.value - 1)
  shareLinkCount.value = autoShareLinkCount.value
}

const increaseHostQuantity = () => {
  hostQuantity.value = Math.min(totalQuantity.value, hostQuantity.value + 1)
  shareLinkCount.value = autoShareLinkCount.value
}

const openGroupBuySheet = () => {
  groupBuyStep.value = 1
  groupBuyError.value = ''
  groupBuySuccess.value = ''
  normalizeCounts()
  isGroupBuySheetOpen.value = true
}

const closeGroupBuySheet = async () => {
  isGroupBuySheetOpen.value = false

  if (groupBuyStep.value === 5) {
    await loadMyGroupBuys()
  }
}

const nextGroupBuyStep = () => {
  if (groupBuyStep.value === 1 && !selectedOptionId.value) return

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

const openGroupDetail = (group) => {
  selectedGroup.value = group
  copiedMemberId.value = null
}

const closeGroupDetail = () => {
  selectedGroup.value = null
  copiedMemberId.value = null
}

const generateInviteToken = () => {
  const randomPart = crypto.randomUUID().replaceAll('-', '').slice(0, 18)
  const timePart = Date.now().toString(36)
  return `${timePart}${randomPart}`
}

const buildInviteUrl = (inviteToken) => `${shareLinkBase.value}?token=${inviteToken}`

const buildInviteText = (inviteToken, group = selectedGroup.value) => {
  const url = buildInviteUrl(inviteToken)
  const productName = group?.products?.name || product.value?.name || '-'
  const optionName = group?.product_options?.name || selectedOption.value?.name || '-'

  return [
    '[고마마 공동구매 참여 링크]',
    `[상품] ${productName} / ${optionName}`,
    '아래 링크로 주소 입력 + 결제 부탁드려요.',
    url,
  ].join('\n')
}

const shareOneInviteLink = async (inviteToken) => {
  const text = buildInviteText(inviteToken)

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
  alert('공유 문구를 복사했어요. 카카오톡에 붙여넣어 보내면 됩니다.')
}

const copyMemberLink = async (inviteToken) => {
  await navigator.clipboard.writeText(buildInviteUrl(inviteToken))
}

const copyInviteLinkWithFeedback = async (member) => {
  if (!member?.invite_token) return

  try {
    await copyMemberLink(member.invite_token)
    copiedMemberId.value = member.id

    setTimeout(() => {
      if (copiedMemberId.value === member.id) {
        copiedMemberId.value = null
      }
    }, 1500)
  } catch {
    alert('링크 복사에 실패했어요.')
  }
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
    groupBuySuccess.value = `${invitedCount}개의 초대 링크가 준비됐어요.`
    await loadMyGroupBuys()
    groupBuyStep.value = 5
  } catch (error) {
    console.error('공동구매 생성 에러:', error)
    groupBuyError.value = '공동구매 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isCreatingGroupBuy.value = false
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
    if (selectedGroup.value?.id === groupBuyId) closeGroupDetail()
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
  <div class="min-h-screen bg-[#f7f8f9] pb-10 pt-5 text-black">
    <div class="mx-auto w-full max-w-[430px]">
      <section class="gm-section">
        <div class="gm-card gm-card-gradient-green">
          <div class="gm-mb-16 flex items-center justify-between gap-3">
            <span class="gm-badge gm-badge-white">고마마 공동구매</span>
            <span class="gm-badge gm-badge-white">개별 결제</span>
          </div>

          <h1 class="gm-card-title">
            친구와 같이 사면<br />
            더 저렴해요
          </h1>

          <p class="gm-card-text">상품과 수량만 정하면 친구에게 보낼 링크가 자동으로 만들어져요.</p>

          <button
            type="button"
            class="gm-button gm-button-full gm-button-lg gm-button-pill gm-button-white gm-mt-16"
            :disabled="isLoading || !!loadError"
            @click="openGroupBuySheet"
          >
            공동구매 시작하기
          </button>
        </div>
      </section>

      <section class="gm-section">
        <div class="gm-notice" :class="isKakaoFriend ? 'gm-notice-success' : 'gm-notice-info'">
          <span class="gm-notice-icon">{{ isKakaoFriend ? '✓' : 'i' }}</span>

          <div class="gm-notice-content">
            <strong class="gm-notice-title">공동구매 할인 안내</strong>
            <p class="gm-notice-text">{{ discountLabel }}</p>
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
            <p class="gm-notice-text">{{ loadError }}</p>
          </div>
        </div>
      </section>

      <section class="gm-section">
        <div class="gm-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="gm-card-title">내 공동구매</h2>
              <p class="gm-card-text gm-card-muted">링크 공유와 결제 상태를 확인하세요.</p>
            </div>

            <button
              type="button"
              class="shrink-0 text-xs font-extrabold text-gray-400"
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
            <h4 class="gm-history-empty-title">아직 공동구매가 없어요</h4>
            <p class="gm-history-empty-text">공동구매를 만들면 이곳에 표시됩니다.</p>
          </div>

          <div v-else class="gm-history-list gm-mt-16">
            <article v-for="group in myGroupBuys" :key="group.id" class="gm-history-card">
              <div class="gm-history-head">
                <div>
                  <strong class="gm-history-title">
                    {{ group.products?.name || '-' }} / {{ group.product_options?.name || '-' }}
                  </strong>
                  <span class="gm-history-date">{{ formatDateTime(group.created_at) }}</span>
                </div>

                <span class="gm-history-status">{{ group.status }}</span>
              </div>

              <div class="gm-history-body">
                <div class="gm-history-row">
                  <span class="gm-history-label">총 수량</span>
                  <span class="gm-history-value">{{ group.total_quantity }}박스</span>
                </div>

                <div class="gm-history-row">
                  <span class="gm-history-label">내 결제</span>
                  <span class="gm-history-value">{{ group.host_quantity }}박스</span>
                </div>

                <div class="gm-history-row">
                  <span class="gm-history-label">초대 링크</span>
                  <span class="gm-history-value">{{ group.share_slot_count }}개</span>
                </div>
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="gm-button gm-button-sm gm-button-pill gm-button-primary"
                  @click="openGroupDetail(group)"
                >
                  링크 공유
                </button>

                <button
                  type="button"
                  class="gm-button gm-button-sm gm-button-pill gm-button-outline"
                  :disabled="deletingGroupBuyId === group.id"
                  @click="deleteGroupBuy(group.id)"
                >
                  {{ deletingGroupBuyId === group.id ? '삭제 중...' : '삭제' }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <div v-if="isGroupBuySheetOpen" class="gm-overlay" @click.self="closeGroupBuySheet">
        <div class="gm-overlay-panel">
          <div class="gm-overlay-header">
            <h2 class="gm-overlay-title">{{ sheetTitle }}</h2>
            <button type="button" class="gm-overlay-close" @click="closeGroupBuySheet">×</button>
          </div>

          <div class="gm-overlay-body">
            <div v-if="groupBuyStep === 1">
              <div class="gm-card gm-card-soft gm-mb-16">
                <div class="flex items-center justify-between gap-3">
                  <strong class="gm-qty-title">상품 옵션 선택</strong>
                  <span class="text-sm font-bold text-rose-500">필수 선택</span>
                </div>
              </div>

              <div class="gm-option-list space-y-2">
                <label
                  v-for="option in options"
                  :key="option.id"
                  class="gm-option-card flex items-center justify-between gap-3 p-4"
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <input
                      v-model="selectedOptionId"
                      type="radio"
                      :value="option.id"
                      class="h-5 w-5"
                    />
                    <span class="truncate text-base font-semibold text-gray-900">
                      {{ product?.name || '고마마정품' }} {{ option.name }}
                    </span>
                  </span>

                  <span class="shrink-0 text-sm font-extrabold text-gray-700">
                    {{ formatCurrency(Math.max(option.price - totalDiscountPerItem, 0)) }}
                  </span>
                </label>
              </div>
            </div>

            <div v-else-if="groupBuyStep === 2">
              <div class="gm-notice gm-notice-info gm-mb-16">
                <span class="gm-notice-icon">2</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">총 몇 박스로 공동구매할까요?</strong>
                  <p class="gm-notice-text">친구들과 함께 주문할 전체 박스 수를 선택해 주세요.</p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-qty-row">
                  <div class="gm-qty-info">
                    <span class="gm-qty-title">총 공동구매 수량</span>
                    <span class="gm-qty-desc">최소 2박스부터 시작할 수 있어요.</span>
                  </div>

                  <div class="gm-qty">
                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="totalQuantity <= 2"
                      @click="decreaseTotalQuantity"
                    >
                      -
                    </button>
                    <span class="gm-qty-value">{{ totalQuantity }}</span>
                    <button type="button" class="gm-qty-button" @click="increaseTotalQuantity">
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div class="gm-notice gm-notice-success gm-mt-16">
                <span class="gm-notice-icon">✓</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">현재 설정</strong>
                  <p class="gm-notice-text">총 {{ totalQuantity }}박스로 공동구매를 진행합니다.</p>
                </div>
              </div>
            </div>

            <div v-else-if="groupBuyStep === 3">
              <div class="gm-notice gm-notice-info gm-mb-16">
                <span class="gm-notice-icon">3</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">나는 몇 박스를 결제할까요?</strong>
                  <p class="gm-notice-text">나머지 수량은 친구에게 보낼 링크로 자동 생성돼요.</p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-qty-row">
                  <div class="gm-qty-info">
                    <span class="gm-qty-title">내 결제 수량</span>
                    <span class="gm-qty-desc">내가 직접 결제할 박스 수입니다.</span>
                  </div>

                  <div class="gm-qty">
                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="hostQuantity <= 1"
                      @click="decreaseHostQuantity"
                    >
                      -
                    </button>
                    <span class="gm-qty-value">{{ hostQuantity }}</span>
                    <button
                      type="button"
                      class="gm-qty-button"
                      :disabled="hostQuantity >= totalQuantity"
                      @click="increaseHostQuantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div class="gm-notice gm-notice-success gm-mt-16">
                <span class="gm-notice-icon">✓</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">초대 링크 자동 생성</strong>
                  <p class="gm-notice-text">
                    내가 {{ hostQuantity }}박스를 결제하고, 친구에게 보낼 링크
                    {{ autoShareLinkCount }}개가 생성됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div v-else-if="groupBuyStep === 4">
              <div class="gm-notice gm-notice-success gm-mb-16">
                <span class="gm-notice-icon">4</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">공동구매 내용을 확인해 주세요</strong>
                  <p class="gm-notice-text">
                    아래 내용으로 공동구매를 만들고 초대 링크를 생성합니다.
                  </p>
                </div>
              </div>

              <div class="gm-card gm-card-soft">
                <div class="gm-summary">
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">상품</span>
                    <span class="gm-summary-value">{{ product?.name || '고마마정품' }}</span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">옵션</span>
                    <span class="gm-summary-value">{{ selectedOption?.name || '-' }}</span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">총 수량</span>
                    <span class="gm-summary-value">{{ totalQuantity }}박스</span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">내 결제 수량</span>
                    <span class="gm-summary-value">{{ hostQuantity }}박스</span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">공유 링크</span>
                    <span class="gm-summary-value">{{ autoShareLinkCount }}개</span>
                  </div>

                  <div class="gm-summary-divider"></div>

                  <div class="gm-summary-row">
                    <span class="gm-summary-label">기본 단가</span>
                    <span class="gm-summary-value">{{ formatCurrency(baseUnitPrice) }}</span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">개당 할인</span>
                    <span class="gm-summary-value gm-summary-discount">
                      - {{ formatCurrency(totalDiscountPerItem) }}
                    </span>
                  </div>
                  <div class="gm-summary-row">
                    <span class="gm-summary-label">공동구매 총액</span>
                    <span class="gm-summary-value">{{ formatCurrency(paymentTotal) }}</span>
                  </div>

                  <div class="gm-summary-divider"></div>

                  <div class="gm-summary-row gm-summary-total">
                    <span class="gm-summary-label">내 예상 결제금액</span>
                    <span class="gm-summary-value">{{ formatCurrency(hostPaymentTotal) }}</span>
                  </div>

                  <span class="gm-summary-small">
                    친구들은 생성된 링크에서 각자 주소 입력과 결제를 진행합니다.
                  </span>
                </div>
              </div>

              <div v-if="groupBuyError" class="gm-notice gm-notice-danger gm-mt-16">
                <span class="gm-notice-icon">!</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">생성 실패</strong>
                  <p class="gm-notice-text">{{ groupBuyError }}</p>
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
                  이제 내 공동구매에서 친구에게<br />
                  초대 링크를 공유하면 됩니다.
                </p>
              </div>

              <div v-if="groupBuySuccess" class="gm-notice gm-notice-success gm-mb-16">
                <span class="gm-notice-icon">✓</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">생성 완료</strong>
                  <p class="gm-notice-text">{{ groupBuySuccess }}</p>
                </div>
              </div>

              <div class="gm-notice gm-notice-info">
                <span class="gm-notice-icon">i</span>
                <div class="gm-notice-content">
                  <strong class="gm-notice-title">링크 공유는 내 공동구매에서</strong>
                  <p class="gm-notice-text">
                    오버레이를 닫고 [링크 공유] 버튼을 눌러 보내면 됩니다.
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

      <div v-if="selectedGroup" class="gm-overlay" @click.self="closeGroupDetail">
        <div class="gm-overlay-panel">
          <div class="gm-overlay-header">
            <h2 class="gm-overlay-title">링크 공유</h2>
            <button type="button" class="gm-overlay-close" @click="closeGroupDetail">×</button>
          </div>

          <div class="gm-overlay-body">
            <div class="gm-notice gm-notice-info gm-mb-16">
              <span class="gm-notice-icon">i</span>
              <div class="gm-notice-content">
                <strong class="gm-notice-title">친구에게 초대 링크를 보내세요</strong>
                <p class="gm-notice-text">참여자는 받은 링크에서 주소 입력과 결제를 진행합니다.</p>
              </div>
            </div>

            <div class="gm-card gm-card-soft gm-mb-16">
              <div class="gm-summary">
                <div class="gm-summary-row">
                  <span class="gm-summary-label">상품</span>
                  <span class="gm-summary-value">{{ selectedGroup.products?.name || '-' }}</span>
                </div>
                <div class="gm-summary-row">
                  <span class="gm-summary-label">옵션</span>
                  <span class="gm-summary-value">{{
                    selectedGroup.product_options?.name || '-'
                  }}</span>
                </div>
                <div class="gm-summary-row">
                  <span class="gm-summary-label">총 수량</span>
                  <span class="gm-summary-value">{{ selectedGroup.total_quantity }}박스</span>
                </div>
                <div class="gm-summary-row">
                  <span class="gm-summary-label">초대 링크</span>
                  <span class="gm-summary-value">{{ selectedGroup.share_slot_count }}개</span>
                </div>
              </div>
            </div>

            <div class="gm-history-list">
              <article
                v-for="member in selectedGroup.group_buy_members || []"
                :key="member.id"
                class="gm-history-card"
              >
                <div class="gm-history-head">
                  <div>
                    <strong class="gm-history-title">
                      #{{ member.slot_no }} {{ member.is_host ? '주최자' : '참여자' }}
                    </strong>
                    <span class="gm-history-date">
                      결제: {{ member.payment_status }} · 주소:
                      {{ member.receiver && member.address ? '완료' : '미입력' }}
                    </span>
                  </div>

                  <span class="gm-history-status">
                    {{ member.payment_status === 'paid' ? '결제완료' : '대기' }}
                  </span>
                </div>

                <div class="mt-3">
                  <template v-if="member.is_host">
                    <button
                      v-if="member.payment_status !== 'paid'"
                      type="button"
                      class="gm-button gm-button-full gm-button-md gm-button-pill gm-button-primary"
                      :disabled="payingHostMemberId === member.id"
                      @click="payHostMember(selectedGroup, member)"
                    >
                      {{ payingHostMemberId === member.id ? '결제 준비 중...' : '주최자 결제하기' }}
                    </button>

                    <div v-else class="gm-notice gm-notice-success">
                      <span class="gm-notice-icon">✓</span>
                      <div class="gm-notice-content">
                        <strong class="gm-notice-title">주최자 결제 완료</strong>
                        <p class="gm-notice-text">주최자 결제가 완료되었습니다.</p>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="member.invite_token">
                    <div class="gm-notice gm-notice-info gm-mb-16">
                      <span class="gm-notice-icon">i</span>
                      <div class="gm-notice-content">
                        <strong class="gm-notice-title">초대 링크 준비됨</strong>
                        <p class="gm-notice-text">
                          링크를 받은 사람은 주소 입력과 결제를 직접 진행합니다.
                        </p>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        class="gm-button gm-button-md gm-button-pill gm-button-outline"
                        @click="copyInviteLinkWithFeedback(member)"
                      >
                        {{ copiedMemberId === member.id ? '복사 완료!' : '링크 복사' }}
                      </button>

                      <button
                        type="button"
                        class="gm-button gm-button-md gm-button-pill gm-button-primary"
                        @click="shareOneInviteLink(member.invite_token)"
                      >
                        바로 공유
                      </button>
                    </div>
                  </template>

                  <template v-else>
                    <div class="gm-notice gm-notice-warning">
                      <span class="gm-notice-icon">!</span>
                      <div class="gm-notice-content">
                        <strong class="gm-notice-title">링크 없음</strong>
                        <p class="gm-notice-text">이 참여자 슬롯에는 초대 링크가 없습니다.</p>
                      </div>
                    </div>
                  </template>
                </div>
              </article>
            </div>
          </div>

          <div class="gm-overlay-footer">
            <button
              type="button"
              class="gm-button gm-button-full gm-button-lg gm-button-pill gm-button-outline"
              @click="closeGroupDetail"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
