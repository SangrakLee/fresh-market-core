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
  <div class="min-h-screen bg-[#f9fafb] px-5 pb-28 pt-6 text-black">
    <div class="mx-auto w-full max-w-[430px] space-y-4">
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs font-semibold tracking-wide text-[#15aabf]">공동구매</p>
        <h1 class="mt-2 text-xl font-bold">공동구매 생성 · 링크 공유 · 결제 상태 확인</h1>
        <p class="mt-2 text-sm text-black/60">
          총 수량/내 결제 수량/공유 링크 수를 입력해 공동구매를 만들고, 링크별 결제 상태를
          확인하세요.
        </p>

        <div class="mt-3 rounded-xl bg-[#f3f4f6] px-3 py-2 text-xs text-black/70">
          <p>{{ discountLabel }}</p>
          <p v-if="isKakaoFriend" class="mt-1">카카오 친구(로그인) 추가 할인: 개당 1,000원</p>
          <p v-else class="mt-1">비회원: 카카오 친구 할인 없음 (원래 금액)</p>
        </div>
      </section>

      <section
        v-if="isLoading"
        class="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-black/5"
      >
        공동구매 상품을 불러오는 중이에요...
      </section>

      <section
        v-else-if="loadError"
        class="rounded-2xl bg-white p-5 text-sm text-red-500 shadow-sm ring-1 ring-black/5"
      >
        {{ loadError }}
      </section>

      <template v-else>
        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">상품/키로수 선택</h2>
          <p class="mt-1 text-sm text-black/60">{{ product?.name || '상품명 없음' }}</p>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="option in options"
              :key="option.id"
              type="button"
              class="rounded-xl border px-3 py-3 text-left text-sm transition"
              :class="
                selectedOptionId === option.id
                  ? 'border-[#15aabf] bg-[#e6fcf5] text-black'
                  : 'border-black/10 bg-white text-black/70'
              "
              @click="selectedOptionId = option.id"
            >
              <p class="font-semibold">{{ option.name }}</p>
              <p class="mt-1 text-xs">기본가 {{ formatCurrency(option.price) }}</p>
            </button>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">공동구매 수량 설정</h2>

          <div class="mt-3 grid grid-cols-3 gap-2">
            <label class="text-xs text-black/60">
              총 수량
              <input
                v-model.number="totalQuantity"
                type="number"
                min="1"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                @change="normalizeCounts"
              />
            </label>

            <label class="text-xs text-black/60">
              내 결제 수량
              <input
                v-model.number="hostQuantity"
                type="number"
                min="1"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                @change="normalizeCounts"
              />
            </label>

            <label class="text-xs text-black/60">
              공유 링크 수
              <input
                v-model.number="shareLinkCount"
                type="number"
                min="0"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                @change="normalizeCounts"
              />
            </label>
          </div>

          <p class="mt-3 rounded-lg bg-[#f8f9fa] px-3 py-2 text-xs text-black/70">
            검증: 내 결제 {{ hostQuantity }} + 링크 {{ shareLinkCount }} = 총 {{ totalQuantity }}
          </p>
          <p v-if="!isSplitRuleValid" class="mt-2 text-xs font-medium text-red-500">
            수량 규칙이 맞지 않아요. 값을 다시 확인해 주세요.
          </p>

          <button
            type="button"
            class="mt-3 w-full rounded-xl bg-[#15aabf] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
            :disabled="isCreatingGroupBuy || !isSplitRuleValid"
            @click="createGroupBuy"
          >
            {{ isCreatingGroupBuy ? '생성 중...' : '공동구매 생성 & 링크 공유' }}
          </button>

          <p v-if="groupBuyError" class="mt-2 text-xs font-semibold text-red-500">
            {{ groupBuyError }}
          </p>
          <p v-if="groupBuySuccess" class="mt-2 text-xs font-semibold text-[#0ca678]">
            {{ groupBuySuccess }}
          </p>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">예상 결제 금액</h2>

          <div class="mt-4 space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-black/60">기본 금액</span>
              <span>{{ formatCurrency(originTotal) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-black/60">총 할인 금액</span>
              <span class="text-[#0ca678]">- {{ formatCurrency(discountTotal) }}</span>
            </div>
            <div
              class="flex items-center justify-between border-t border-black/10 pt-2 text-base font-semibold"
            >
              <span>최종 결제 금액</span>
              <span>{{ formatCurrency(paymentTotal) }}</span>
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">내 공동구매 현황</h2>
            <button
              type="button"
              class="text-xs font-semibold text-[#15aabf]"
              @click="loadMyGroupBuys"
            >
              새로고침
            </button>
          </div>

          <p v-if="isLoadingMyGroupBuys" class="mt-2 text-xs text-black/50">불러오는 중...</p>
          <p v-else-if="!myGroupBuys.length" class="mt-2 text-xs text-black/50">
            생성한 공동구매가 없습니다.
          </p>

          <div v-else class="mt-3 space-y-3">
            <article
              v-for="group in myGroupBuys"
              :key="group.id"
              class="rounded-xl border border-black/10 p-3"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold">상태: {{ group.status }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-black/50">{{
                    new Date(group.created_at).toLocaleString()
                  }}</span>
                  <button
                    type="button"
                    class="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="deletingGroupBuyId === group.id"
                    @click="deleteGroupBuy(group.id)"
                  >
                    {{ deletingGroupBuyId === group.id ? '삭제중...' : '삭제' }}
                  </button>
                </div>
              </div>
              <p class="mt-1 text-xs text-black/60">
                총 {{ group.total_quantity }}개 / 내 결제 {{ group.host_quantity }}개 / 링크
                {{ group.share_slot_count }}개
              </p>
              <p class="mt-1 text-xs text-black/50">
                상품: {{ group.products?.name || '-' }} / 옵션:
                {{ group.product_options?.name || '-' }}
              </p>

              <div class="mt-2 overflow-x-auto">
                <table class="min-w-full text-left text-xs">
                  <thead class="text-black/50">
                    <tr>
                      <th class="py-1 pr-3">슬롯</th>
                      <th class="py-1 pr-3">결제</th>
                      <th class="py-1 pr-3">주소입력</th>
                      <th class="py-1">링크</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="member in group.group_buy_members"
                      :key="member.id"
                      class="border-t border-black/5"
                    >
                      <td class="py-1 pr-3">#{{ member.slot_no }}</td>
                      <td class="py-1 pr-3">{{ member.payment_status }}</td>
                      <td class="py-1 pr-3">
                        {{ member.receiver && member.address ? '완료' : '미입력' }}
                      </td>
                      <td class="py-1">
                        <template v-if="member.is_host">
                          <button
                            v-if="member.payment_status !== 'paid'"
                            type="button"
                            class="text-[#f08c00] underline disabled:opacity-50"
                            :disabled="payingHostMemberId === member.id"
                            @click="payHostMember(group, member)"
                          >
                            {{
                              payingHostMemberId === member.id
                                ? '결제 준비중...'
                                : '주최자 결제하기'
                            }}
                          </button>
                          <span v-else class="text-[#0ca678]">결제완료</span>
                        </template>
                        <template v-else-if="member.invite_token">
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="text-[#15aabf] underline"
                              @click="copyMemberLink(member.invite_token)"
                            >
                              복사
                            </button>
                            <button
                              type="button"
                              class="text-[#0ca678] underline"
                              @click="shareOneInviteLink(member.invite_token)"
                            >
                              공유
                            </button>
                          </div>
                        </template>
                        <span v-else class="text-black/40">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
