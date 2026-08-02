import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";

const permissionKey = ["locationPermission"];

export function useLocationPermission() {
  return useQuery({
    queryKey: permissionKey,
    queryFn: async () => Location.getForegroundPermissionsAsync()
  });
}

export function useLocationPermissionActions() {
  const queryClient = useQueryClient();

  const requestPermission = useMutation({
    mutationFn: async () => Location.requestForegroundPermissionsAsync(),
    onSuccess: (permission) => {
      queryClient.setQueryData(permissionKey, permission);
    }
  });

  return {
    requestWhenInUse: requestPermission.mutate,
    requestWhenInUseAsync: requestPermission.mutateAsync,
    isRequesting: requestPermission.isPending
  };
}
