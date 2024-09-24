<template>
  <HoppSmartModal
    dialog
    :title="t('users.change_password')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <HoppSmartInput
        v-model="oldPassword"
        :label="t('users.old_password')"
        input-styles="floating-input"
        class="mb-12"
      />

      <HoppSmartInput
        v-model="newPassword"
        :label="t('users.new_password')"
        class="mb-12"
        input-styles="floating-input"
      />

      <HoppSmartInput
        v-model="repeatNewPassword"
        :label="t('users.repeat_new_password')"
        input-styles="floating-input"
      />
    </template>
    <template #footer>
      <div class="flex justify-end space-x-2 w-full">
        <HoppButtonSecondary
          :label="t('users.cancel')"
          outline
          filled
          @click="hideModal"
        />
        <HoppButtonPrimary
          :label="t('action.confirm')"
          @click="emit('change-password', oldPassword, newPassword, repeatNewPassword)"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '~/composables/i18n';

const t = useI18n();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'change-password', id: string, newPwd: string, oldPwd: string): void;
}>();

const oldPassword = ref('');
const newPassword = ref('');
const repeatNewPassword = ref('');

const hideModal = () => {
  emit('hide-modal');
};
</script>
