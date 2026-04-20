<script setup>
import { Citrus } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const detailImageModules = import.meta.glob('../assets/images/detail-img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const detailImagePaths = Object.values(detailImageModules).sort()

const weightOptions = [
  { key: '4kg', label: '4kg' },
  { key: '10kg', label: '10kg' },
]

const products = computed(() =>
  weightOptions.map((option, index) => ({
    ...option,
    imagePath: detailImagePaths[index] ?? '',
  })),
)

const activeTab = ref(weightOptions[0].key)
const selectedWeights = ref([])

const activeProduct = computed(
  () => products.value.find((product) => product.key === activeTab.value) ?? products.value[0],
)
</script>

<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto flex max-w-[430px] flex-col">
      <div class="bg-white px-2 shadow-sm">
        <div class="flex items-center justify-start gap-2">
          <button
            v-for="product in products"
            :key="product.key"
            type="button"
            class="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition"
            @click="activeTab = product.key"
          >
            <span
              class="flex h-9 w-9 items-center justify-center rounded-full"
              :class="
                activeTab === product.key
                  ? 'border-yellow-400 bg-yellow-100 text-yellow-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              "
            >
              <Citrus class="h-4 w-4" aria-hidden="true" />
            </span>
            <span
              class="text-[11px] font-semibold"
              :class="activeTab === product.key ? 'text-gray-900' : 'text-gray-500'"
            >
              {{ product.label }}
            </span>
            <span
              class="h-0.5 w-7 rounded-full"
              :class="activeTab === product.key ? 'bg-yellow-400' : 'bg-transparent'"
            />
          </button>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl bg-white shadow-sm">
        <img
          v-if="activeProduct?.imagePath"
          :src="activeProduct.imagePath"
          :alt="`${activeProduct.label} 상품 이미지`"
          class="h-[600px] w-full object-cover"
        />
        <div v-else class="flex h-[600px] items-center justify-center text-sm text-gray-500">
          이미지가 준비되지 않았습니다.
        </div>
      </div>

      <div class="bg-white p-3">
        <div class="flex flex-col gap-1.5">
          <label
            v-for="product in products"
            :key="`checkbox-${product.key}`"
            class="flex items-center gap-2 text-sm text-gray-700"
          >
            <input v-model="selectedWeights" type="checkbox" :value="product.key" class="h-4 w-4" />
            <span>{{ product.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
