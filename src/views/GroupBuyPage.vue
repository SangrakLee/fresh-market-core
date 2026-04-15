<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const product = ref(null)
const options = ref([])
const selectedOptionId = ref(null)
const quantity = ref(1)
const isKakaoFriend = ref(false)
const isLoading = ref(true)
const loadError = ref('')

const addressBook = ref([
  {
    receiver: '',
    phone: '',
    address: '',
  },
])

const selectedOption = computed(() => {
  return options.value.find((option) => option.id === selectedOptionId.value) || null
})

const baseUnitPrice = computed(() => selectedOption.value?.price || 0)

const groupDiscountPerItem = computed(() => {
  if (quantity.value >= 10 && quantity.value <= 19) return 3000
  if (quantity.value >= 5 && quantity.value <= 9) return 2000
  return 0
})

const kakaoFriendDiscountPerItem = computed(() => (isKakaoFriend.value ? 1000 : 0))

const totalDiscountPerItem = computed(() => {
  return groupDiscountPerItem.value + kakaoFriendDiscountPerItem.value
})

const finalUnitPrice = computed(() => {
  return Math.max(baseUnitPrice.value - totalDiscountPerItem.value, 0)
})

const originTotal = computed(() => baseUnitPrice.value * quantity.value)
const discountTotal = computed(() => totalDiscountPerItem.value * quantity.value)
const paymentTotal = computed(() => finalUnitPrice.value * quantity.value)

const discountLabel = computed(() => {
  if (groupDiscountPerItem.value === 3000) return '공동구매 10~19개 구간 적용 (개당 3,000원 할인)'
  if (groupDiscountPerItem.value === 2000) return '공동구매 5~9개 구간 적용 (개당 2,000원 할인)'
  return '공동구매 할인 미적용 (5개 이상부터 적용)'
})

watch(
  quantity,
  (newQuantity) => {
    const normalizedQuantity = Number.isFinite(newQuantity)
      ? Math.max(1, Math.floor(newQuantity))
      : 1
    if (normalizedQuantity !== newQuantity) {
      quantity.value = normalizedQuantity
      return
    }

    const existing = [...addressBook.value]
    const next = Array.from({ length: normalizedQuantity }, (_, index) => {
      return (
        existing[index] || {
          receiver: '',
          phone: '',
          address: '',
        }
      )
    })

    addressBook.value = next
  },
  { immediate: true },
)

const increaseQty = () => {
  quantity.value += 1
}

const decreaseQty = () => {
  if (quantity.value > 1) quantity.value -= 1
}

const formatCurrency = (price) => `${price.toLocaleString()}원`

const updateAddressField = (index, field, value) => {
  const next = [...addressBook.value]
  next[index] = {
    ...next[index],
    [field]: value,
  }
  addressBook.value = next
}

const sharePaymentInfo = async () => {
  const shareText = [
    `[고마마 공동구매] ${product.value?.name || '상품'}`,
    `옵션: ${selectedOption.value?.name || '-'}`,
    `수량: ${quantity.value}개`,
    `결제 예정 금액: ${formatCurrency(paymentTotal.value)}`,
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: '공동구매 결제 금액 공유',
        text: shareText,
      })
      return
    } catch {
      // 사용자가 취소했거나 공유 실패한 경우 clipboard fallback 실행
    }
  }

  try {
    await navigator.clipboard.writeText(shareText)
    alert('공유 문구를 복사했어요. 카카오톡에 붙여넣어 공유해 주세요!')
  } catch {
    alert('공유를 지원하지 않는 환경이에요.\n' + shareText)
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
})
</script>

<template>
  <div class="min-h-screen bg-[#f9fafb] px-5 pb-28 pt-6 text-black">
    <div class="mx-auto w-full max-w-[430px] space-y-4">
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs font-semibold tracking-wide text-[#15aabf]">공동구매</p>
        <h1 class="mt-2 text-xl font-bold">수량 선택하면 바로 결제 금액 확인</h1>
        <p class="mt-2 text-sm text-black/60">
          5~9개는 개당 2,000원, 10~19개는 개당 3,000원 자동 할인돼요.
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

          <div class="mt-5 flex items-center justify-between">
            <span class="text-sm font-medium">수량 선택</span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="h-9 w-9 rounded-full border border-black/10 text-lg"
                @click="decreaseQty"
              >
                -
              </button>
              <span class="min-w-8 text-center font-semibold">{{ quantity }}</span>
              <button
                type="button"
                class="h-9 w-9 rounded-full border border-black/10 text-lg"
                @click="increaseQty"
              >
                +
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">주소록 (선택 수량만큼 생성)</h2>
          <p class="mt-1 text-sm text-black/60">총 {{ addressBook.length }}개 배송지</p>

          <div class="mt-4 space-y-3">
            <div
              v-for="(entry, index) in addressBook"
              :key="index"
              class="rounded-xl border border-black/10 p-3"
            >
              <p class="mb-2 text-xs font-semibold text-black/50">배송지 {{ index + 1 }}</p>

              <label class="mb-2 block text-xs text-black/60">수령인</label>
              <input
                :value="entry.receiver"
                type="text"
                class="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="수령인 이름"
                @input="updateAddressField(index, 'receiver', $event.target.value)"
              />

              <label class="mb-2 block text-xs text-black/60">연락처</label>
              <input
                :value="entry.phone"
                type="text"
                class="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="010-0000-0000"
                @input="updateAddressField(index, 'phone', $event.target.value)"
              />

              <label class="mb-2 block text-xs text-black/60">주소</label>
              <input
                :value="entry.address"
                type="text"
                class="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="도로명 주소"
                @input="updateAddressField(index, 'address', $event.target.value)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">결제 금액</h2>

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

          <button
            type="button"
            class="mt-4 w-full rounded-xl bg-[#fee500] px-4 py-3 text-sm font-semibold text-black"
            @click="sharePaymentInfo"
          >
            카카오톡으로 결제 금액 공유하기
          </button>
        </section>
      </template>
    </div>
  </div>
</template>
